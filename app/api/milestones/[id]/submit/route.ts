import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ProfileRow } from "@/lib/supabase";
import { SubmitDeliverableSchema } from "@/lib/contract-schema";
import { changeMilestoneStatusOnChain, tryOnChain } from "@/lib/tw-actions";
import { isTrustlessWorkConfigured } from "@/lib/trustless-work";
import { logger } from "@/lib/logger";

/* ---------------------------------------------------------------------------
 * Milestone submit (by the freelancer).
 *
 *   1. Persist deliverable files / links / note.
 *   2. Set milestone status → 'submitted' + auto_release_at.
 *   3. If the contract is on-chain (TW key set + escrow_id present + not mock),
 *      call TW changeMilestoneStatus("done") signed by the freelancer's
 *      Privy Stellar wallet. Best-effort: chain failure logs a warning but
 *      doesn't block the submission.
 * ------------------------------------------------------------------------ */

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = SubmitDeliverableSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: milestone } = await db.from("milestones").select("*, contracts!inner(*)").eq("id", id).single();
  if (!milestone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = (milestone as any).contracts;
  if (contract.freelancer_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const autoReleaseAt = new Date(now.getTime() + (contract.auto_release_days ?? 7) * 24 * 3600 * 1000);

  const { data: updated, error } = await db
    .from("milestones")
    .update({
      status: "submitted",
      deliverable_files: parsed.data.files,
      deliverable_links: parsed.data.links,
      deliverable_note: parsed.data.note,
      submitted_at: now.toISOString(),
      auto_release_at: autoReleaseAt.toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("activity").insert({
    contract_id: contract.id,
    milestone_id: id,
    actor_id: user.did,
    type: "submitted",
    metadata: { milestone_position: (milestone as { position: number }).position },
  });

  // Best-effort on-chain status update — only when the escrow is real.
  const isMock =
    !isTrustlessWorkConfigured() ||
    !contract.escrow_id ||
    String(contract.escrow_id).startsWith("mock_");
  let onChain: { ok: boolean; tx_hash?: string | null; error?: string | null } = {
    ok: false,
  };
  if (!isMock) {
    const { data: freelancer } = await db
      .from("profiles")
      .select("stellar_wallet_id, payout_address")
      .eq("id", user.did)
      .maybeSingle();
    const fl = freelancer as Pick<ProfileRow, "stellar_wallet_id" | "payout_address"> | null;
    if (fl?.stellar_wallet_id && fl?.payout_address) {
      const result = await tryOnChain("milestone.changeStatus", () =>
        changeMilestoneStatusOnChain({
          escrowContractId: contract.escrow_id,
          milestoneIndex:
            (milestone as { tw_milestone_index: number | null; position: number })
              .tw_milestone_index ??
            (milestone as { position: number }).position,
          newStatus: "done",
          signer: { walletId: fl.stellar_wallet_id!, address: fl.payout_address! },
        }),
      );
      onChain = {
        ok: result.ok,
        tx_hash: result.result?.tx_hash ?? null,
        error: result.error,
      };
      if (result.ok && result.result?.tx_hash) {
        await db.from("activity").insert({
          contract_id: contract.id,
          milestone_id: id,
          actor_id: user.did,
          type: "submitted",
          metadata: {
            on_chain: true,
            tx_hash: result.result.tx_hash,
          },
        });
      }
    } else {
      logger.warn("milestone.submit.no_freelancer_wallet", {
        milestone_id: id,
        did: user.did,
      });
    }
  }

  return NextResponse.json({ milestone: updated, on_chain: onChain });
}
