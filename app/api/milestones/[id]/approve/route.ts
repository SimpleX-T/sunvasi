import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ProfileRow } from "@/lib/supabase";
import {
  approveMilestoneOnChain,
  releaseMilestoneFundsOnChain,
  tryOnChain,
} from "@/lib/tw-actions";
import { isTrustlessWorkConfigured } from "@/lib/trustless-work";
import { logger } from "@/lib/logger";

/* ---------------------------------------------------------------------------
 * Milestone approval (by the client).
 *
 *   1. If the contract is on-chain, call TW approveMilestone +
 *      releaseMilestoneFunds with the client's Privy Stellar wallet.
 *   2. Persist status → 'released' (or 'approved' if release failed) + dates.
 *   3. Move the next pending milestone to 'in_progress'.
 *   4. Mark the contract completed when all milestones are released.
 *
 *   On-chain failures don't roll back DB state — we surface the error and
 *   leave the milestone status reflecting reality so the client can retry.
 * ------------------------------------------------------------------------ */

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: milestone } = await db
    .from("milestones")
    .select("*, contracts!inner(*)")
    .eq("id", id)
    .single();
  if (!milestone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = (milestone as any).contracts;
  if (contract.client_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const isMock =
    !isTrustlessWorkConfigured() ||
    !contract.escrow_id ||
    String(contract.escrow_id).startsWith("mock_");

  let approveResult: { ok: boolean; tx_hash?: string | null; error?: string | null } = {
    ok: true,
  };
  let releaseResult: { ok: boolean; tx_hash?: string | null; error?: string | null } = {
    ok: true,
  };

  if (!isMock) {
    const { data: client } = await db
      .from("profiles")
      .select("stellar_wallet_id, payout_address")
      .eq("id", user.did)
      .maybeSingle();
    const cl = client as Pick<ProfileRow, "stellar_wallet_id" | "payout_address"> | null;
    if (!cl?.stellar_wallet_id || !cl?.payout_address) {
      return NextResponse.json(
        {
          error: "client_wallet_missing",
          message:
            "Your Stellar wallet isn't ready. Refresh your profile and try again — the server will provision it on next sign-in.",
        },
        { status: 412 },
      );
    }
    const milestoneIndex =
      (milestone as { tw_milestone_index: number | null; position: number })
        .tw_milestone_index ??
      (milestone as { position: number }).position;

    const approve = await tryOnChain("milestone.approve", () =>
      approveMilestoneOnChain({
        escrowContractId: contract.escrow_id,
        milestoneIndex,
        signer: { walletId: cl.stellar_wallet_id!, address: cl.payout_address! },
      }),
    );
    approveResult = {
      ok: approve.ok || /already.*approved/i.test(approve.error ?? ""),
      tx_hash: approve.result?.tx_hash ?? null,
      error: approve.error,
    };
    if (!approveResult.ok) {
      logger.error("milestone.approve.failed", {
        milestone_id: id,
        error: approve.error,
      });
      return NextResponse.json(
        { error: "approve_failed", message: approve.error, stage: "approve" },
        { status: 502 },
      );
    }

    const release = await tryOnChain("milestone.release", () =>
      releaseMilestoneFundsOnChain({
        escrowContractId: contract.escrow_id,
        milestoneIndex,
        signer: { walletId: cl.stellar_wallet_id!, address: cl.payout_address! },
      }),
    );
    releaseResult = {
      ok: release.ok || /already.*released/i.test(release.error ?? ""),
      tx_hash: release.result?.tx_hash ?? null,
      error: release.error,
    };
    if (!releaseResult.ok) {
      logger.error("milestone.release.failed", {
        milestone_id: id,
        error: release.error,
      });
      // Approval succeeded but release didn't — mark approved (not released)
      // so the client knows the milestone is half-way through.
      const now = new Date().toISOString();
      await db
        .from("milestones")
        .update({ status: "approved", approved_at: now })
        .eq("id", id);
      return NextResponse.json(
        {
          error: "release_failed",
          message: release.error,
          stage: "release",
          approved_tx: approveResult.tx_hash,
        },
        { status: 502 },
      );
    }
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from("milestones")
    .update({ status: "released", approved_at: now, released_at: now })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("activity").insert({
    contract_id: contract.id,
    milestone_id: id,
    actor_id: user.did,
    type: "approved",
    metadata: {
      milestone_position: (milestone as { position: number }).position,
      on_chain: !isMock,
      approve_tx: approveResult.tx_hash ?? null,
      release_tx: releaseResult.tx_hash ?? null,
    },
  });

  // Advance the next pending milestone to in_progress.
  await db
    .from("milestones")
    .update({ status: "in_progress" })
    .eq("contract_id", contract.id)
    .eq("status", "pending")
    .eq("position", (milestone as { position: number }).position + 1);

  // Contract complete?
  const { data: remaining } = await db
    .from("milestones")
    .select("status")
    .eq("contract_id", contract.id);
  const allDone = (remaining ?? []).every(
    (r) => (r as { status: string }).status === "released",
  );
  if (allDone) {
    await db
      .from("contracts")
      .update({ status: "completed", completed_at: now })
      .eq("id", contract.id);
  }

  return NextResponse.json({
    milestone: updated,
    on_chain: {
      approve: approveResult,
      release: releaseResult,
    },
  });
}
