/* ---------------------------------------------------------------------------
 * Auto-release worker (demo-grade).
 *
 *   No persistent cron in the demo — instead, the auto-release check piggy-
 *   backs on user-driven polling. Two callers fire it:
 *
 *     • /api/wallet/balance — the freelancer's profile polls every 20s,
 *       which is exactly the cadence we want for "approve overdue milestones"
 *     • lib/auto-release (this file) — also exposed via /api/auto-release/run
 *       for ad-hoc kicks
 *
 *   For each overdue milestone we run the same `payAndApproveMilestone`
 *   sequence the client would run manually. The client's Privy wallet signs
 *   (via app secret — the wallet is app-owned). The activity log records
 *   `trigger: "auto_release"` so the audit trail is explicit about how the
 *   release happened.
 *
 *   Production note: in a real deployment the client should explicitly
 *   opt-in to auto-release as a per-contract / per-user preference. For the
 *   demo it's always on once SUNVASI_DEMO_AUTO_RELEASE_SECONDS is set.
 * ------------------------------------------------------------------------ */

import { supabaseAdmin } from "@/lib/supabase";
import { payAndApproveMilestone } from "@/lib/milestone-actions";
import { logger } from "@/lib/logger";

interface OverdueRow {
  id: string;
  contract_id: string;
  position: number;
  auto_release_at: string;
  contracts: {
    freelancer_id: string | null;
    client_id: string | null;
  };
}

export interface AutoReleaseSummary {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    milestone_id: string;
    ok: boolean;
    stage?: string;
    error?: string;
  }>;
}

/** Find every submitted milestone whose auto-release deadline has passed
 * AND that involves `did` (as either freelancer or client). Process each.
 * `did=null` processes ALL overdue milestones globally (used by a future
 * cron route). */
export async function processOverdueMilestones(
  did: string | null,
): Promise<AutoReleaseSummary> {
  const db = supabaseAdmin();

  // Fetch overdue milestones scoped to the caller.
  let query = db
    .from("milestones")
    .select(
      "id, contract_id, position, auto_release_at, contracts!inner(freelancer_id, client_id)",
    )
    .eq("status", "submitted")
    .lt("auto_release_at", new Date().toISOString())
    .limit(20);
  if (did) {
    // Either party can trigger the process — both have a legitimate interest.
    query = query.or(
      `freelancer_id.eq.${did},client_id.eq.${did}`,
      { foreignTable: "contracts" },
    );
  }

  const { data: overdue, error } = await query;
  if (error) {
    logger.warn("auto_release.query_failed", { message: error.message });
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }
  const rows = (overdue ?? []) as unknown as OverdueRow[];
  if (rows.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  // Process sequentially — same wallet would race fund/approve/release if we
  // fan out in parallel.
  const results: AutoReleaseSummary["results"] = [];
  for (const row of rows) {
    try {
      const r = await payAndApproveMilestone({
        milestoneId: row.id,
        trigger: "auto_release",
      });
      results.push({
        milestone_id: row.id,
        ok: r.ok,
        stage: r.error?.stage,
        error: r.error?.message,
      });
      if (r.ok) {
        logger.info("auto_release.succeeded", {
          milestone_id: row.id,
          contract_id: row.contract_id,
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.warn("auto_release.threw", { milestone_id: row.id, message });
      results.push({ milestone_id: row.id, ok: false, error: message });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
