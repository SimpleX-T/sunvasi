/* ---------------------------------------------------------------------------
 * Pay & approve a milestone end-to-end.
 *
 *   Runs the three on-chain operations in sequence (fund → approve → release)
 *   signed by the client's Privy Stellar wallet, then updates DB state and
 *   logs the activity. Returns a structured result so callers can surface
 *   per-stage errors.
 *
 *   Used by:
 *     - /api/milestones/[id]/approve  (client clicks Pay & approve)
 *     - lib/auto-release             (server-side timer fires)
 * ------------------------------------------------------------------------ */

import { supabaseAdmin, type ContractRow, type MilestoneRow, type ProfileRow } from "@/lib/supabase";
import {
  approveMilestoneOnChain,
  fundEscrowOnChain,
  releaseMilestoneFundsOnChain,
  tryOnChain,
} from "@/lib/tw-actions";
import { isTrustlessWorkConfigured } from "@/lib/trustless-work";
import { logger } from "@/lib/logger";

export type Stage = "fund" | "approve" | "release";

export interface PayAndApproveResult {
  ok: boolean;
  milestone: MilestoneRow | null;
  on_chain: {
    fund?: { ok: boolean; tx_hash?: string | null; error?: string | null };
    approve?: { ok: boolean; tx_hash?: string | null; error?: string | null };
    release?: { ok: boolean; tx_hash?: string | null; error?: string | null };
  };
  error?: { stage: Stage | "preflight"; message: string; body?: unknown };
}

export async function payAndApproveMilestone(args: {
  milestoneId: string;
  /** "auto_release" when the timer expired; "client" when the client clicked
   * Pay & approve manually. Stored in the activity log for auditability. */
  trigger: "client" | "auto_release";
}): Promise<PayAndApproveResult> {
  const db = supabaseAdmin();

  const { data: milestoneRaw } = await db
    .from("milestones")
    .select("*, contracts!inner(*)")
    .eq("id", args.milestoneId)
    .single();
  if (!milestoneRaw) {
    return {
      ok: false,
      milestone: null,
      on_chain: {},
      error: { stage: "preflight", message: "milestone_not_found" },
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const milestone = milestoneRaw as MilestoneRow & { contracts: ContractRow };
  const contract = milestone.contracts;

  // Status guard: only submitted milestones are releasable.
  if (milestone.status !== "submitted") {
    return {
      ok: false,
      milestone,
      on_chain: {},
      error: {
        stage: "preflight",
        message: `Milestone is ${milestone.status}, not submitted.`,
      },
    };
  }

  const isMock =
    !isTrustlessWorkConfigured() ||
    !contract.escrow_id ||
    String(contract.escrow_id).startsWith("mock_");

  const result: PayAndApproveResult = { ok: true, milestone, on_chain: {} };

  if (!isMock && contract.client_id) {
    const { data: clientRaw } = await db
      .from("profiles")
      .select("stellar_wallet_id, payout_address")
      .eq("id", contract.client_id)
      .maybeSingle();
    const client = clientRaw as Pick<ProfileRow, "stellar_wallet_id" | "payout_address"> | null;
    if (!client?.stellar_wallet_id || !client?.payout_address) {
      return {
        ok: false,
        milestone,
        on_chain: {},
        error: { stage: "preflight", message: "client_wallet_missing" },
      };
    }
    const signer = { walletId: client.stellar_wallet_id, address: client.payout_address };
    const milestoneIndex = milestone.tw_milestone_index ?? milestone.position;
    const amount = Number(milestone.amount_usdc);

    // Step 1 — fund.
    const fund = await tryOnChain("milestone.fundEscrow", () =>
      fundEscrowOnChain({ escrowContractId: contract.escrow_id!, amount, signer }),
    );
    const fundOk = fund.ok || /already.*funded|sufficient.*balance/i.test(fund.error ?? "");
    result.on_chain.fund = {
      ok: fundOk,
      tx_hash: fund.result?.tx_hash ?? null,
      error: fund.error,
    };
    if (!fundOk) {
      logger.error("milestone.pay_approve.fund_failed", {
        milestone_id: milestone.id,
        trigger: args.trigger,
        error: fund.error,
        body: fund.body,
      });
      return {
        ...result,
        ok: false,
        error: { stage: "fund", message: fund.error ?? "fund failed", body: fund.body },
      };
    }

    // Step 2 — approve.
    const approve = await tryOnChain("milestone.approve", () =>
      approveMilestoneOnChain({ escrowContractId: contract.escrow_id!, milestoneIndex, signer }),
    );
    const approveOk = approve.ok || /already.*approved/i.test(approve.error ?? "");
    result.on_chain.approve = {
      ok: approveOk,
      tx_hash: approve.result?.tx_hash ?? null,
      error: approve.error,
    };
    if (!approveOk) {
      logger.error("milestone.pay_approve.approve_failed", {
        milestone_id: milestone.id,
        trigger: args.trigger,
        error: approve.error,
        body: approve.body,
      });
      return {
        ...result,
        ok: false,
        error: { stage: "approve", message: approve.error ?? "approve failed", body: approve.body },
      };
    }

    // Step 3 — release.
    const release = await tryOnChain("milestone.release", () =>
      releaseMilestoneFundsOnChain({
        escrowContractId: contract.escrow_id!,
        milestoneIndex,
        signer,
      }),
    );
    const releaseOk = release.ok || /already.*released/i.test(release.error ?? "");
    result.on_chain.release = {
      ok: releaseOk,
      tx_hash: release.result?.tx_hash ?? null,
      error: release.error,
    };
    if (!releaseOk) {
      logger.error("milestone.pay_approve.release_failed", {
        milestone_id: milestone.id,
        trigger: args.trigger,
        error: release.error,
        body: release.body,
      });
      // Mark approved (not released) so the next call can retry just the release.
      const now = new Date().toISOString();
      await db.from("milestones").update({ status: "approved", approved_at: now }).eq("id", milestone.id);
      return {
        ...result,
        ok: false,
        error: { stage: "release", message: release.error ?? "release failed", body: release.body },
      };
    }
  }

  // All on-chain ok (or mock) → mark released.
  const now = new Date().toISOString();
  const { data: updated } = await db
    .from("milestones")
    .update({ status: "released", approved_at: now, released_at: now })
    .eq("id", milestone.id)
    .select()
    .single<MilestoneRow>();
  if (updated) result.milestone = updated;

  await db.from("activity").insert({
    contract_id: contract.id,
    milestone_id: milestone.id,
    actor_id: contract.client_id,
    type: args.trigger === "auto_release" ? "auto_released" : "approved",
    metadata: {
      milestone_position: milestone.position,
      on_chain: !isMock,
      trigger: args.trigger,
      fund_tx: result.on_chain.fund?.tx_hash ?? null,
      approve_tx: result.on_chain.approve?.tx_hash ?? null,
      release_tx: result.on_chain.release?.tx_hash ?? null,
    },
  });

  // Advance next pending milestone.
  await db
    .from("milestones")
    .update({ status: "in_progress" })
    .eq("contract_id", contract.id)
    .eq("status", "pending")
    .eq("position", milestone.position + 1);

  // Mark contract completed if all released.
  const { data: remaining } = await db
    .from("milestones")
    .select("status")
    .eq("contract_id", contract.id);
  const allDone = (remaining ?? []).every((r) => (r as { status: string }).status === "released");
  if (allDone) {
    await db.from("contracts").update({ status: "completed", completed_at: now }).eq("id", contract.id);
  }

  return result;
}
