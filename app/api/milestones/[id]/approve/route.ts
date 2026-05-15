import { NextResponse } from "next/server";
import { verifyUserFromHeaders } from "@/lib/privy";
import { getVerifiedEmailsForUser } from "@/lib/privy-server";
import { supabaseAdmin, type ProfileRow } from "@/lib/supabase";
import {
  approveMilestoneOnChain,
  fundEscrowOnChain,
  releaseMilestoneFundsOnChain,
  tryOnChain,
} from "@/lib/tw-actions";
import { isTrustlessWorkConfigured } from "@/lib/trustless-work";
import { logger } from "@/lib/logger";

/* ---------------------------------------------------------------------------
 * Milestone approval = "pay & approve" in Sunvasi's model.
 *
 *   The client doesn't pre-fund the whole contract up front — they pay each
 *   milestone at approval time. Concretely, this route does three on-chain
 *   ops in sequence (all signed by the client's Privy Stellar wallet):
 *
 *     1. fundEscrow(amount)          — moves USDC from client → escrow
 *     2. approveMilestone(index)     — marks the milestone approved
 *     3. releaseMilestoneFunds(idx)  — moves USDC from escrow → freelancer
 *
 *   Then it persists status → 'released' and advances the next milestone.
 *
 *   Authorisation is strict: only the named client (matched by Privy-verified
 *   email against contract.client_email, OR by bound client_id) can approve.
 *   Invitees and the freelancer cannot.
 *
 *   On-chain failures don't roll back DB state — we surface the error and
 *   leave the milestone status reflecting reality so the client can retry.
 * ------------------------------------------------------------------------ */

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await verifyUserFromHeaders(req.headers);
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const user = { did: auth.did };

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

  // Only the named client can approve. Match by DID (if bound) OR by the
  // Privy-verified linked email matching contract.client_email.
  let isClient = contract.client_id === user.did;
  if (!isClient && contract.client_email) {
    try {
      const emails = await getVerifiedEmailsForUser(auth.did);
      const target = String(contract.client_email).toLowerCase();
      isClient = emails.includes(target);
    } catch (e) {
      logger.warn("approve.email_lookup_failed", {
        did: auth.did,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if (!isClient) {
    return NextResponse.json(
      {
        error: "not_the_client",
        message: `Only ${contract.client_email ?? "the client"} can approve milestones on this contract.`,
      },
      { status: 403 },
    );
  }

  const isMock =
    !isTrustlessWorkConfigured() ||
    !contract.escrow_id ||
    String(contract.escrow_id).startsWith("mock_");

  let fundResult: { ok: boolean; tx_hash?: string | null; error?: string | null } = {
    ok: true,
  };
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
    const amount = Number(
      (milestone as { amount_usdc: number | string }).amount_usdc,
    );

    // Step 1 — fund the escrow with this milestone's USDC. Pre-fund the
    // escrow each milestone so the client only commits funds when they're
    // about to approve. "Already funded" errors are tolerated as no-op
    // (idempotent re-tries).
    const fund = await tryOnChain("milestone.fundEscrow", () =>
      fundEscrowOnChain({
        escrowContractId: contract.escrow_id,
        amount,
        signer: { walletId: cl.stellar_wallet_id!, address: cl.payout_address! },
      }),
    );
    fundResult = {
      ok: fund.ok || /already.*funded|sufficient.*balance/i.test(fund.error ?? ""),
      tx_hash: fund.result?.tx_hash ?? null,
      error: fund.error,
    };
    if (!fundResult.ok) {
      logger.error("milestone.fund.failed", {
        milestone_id: id,
        error: fund.error,
        body: fund.body,
      });
      return NextResponse.json(
        {
          error: "fund_failed",
          message:
            fund.error ??
            "Couldn't move USDC into escrow. Your wallet may be short — top up from the Circle faucet and retry.",
          stage: "fund",
          body: fund.body,
        },
        { status: 502 },
      );
    }

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
        body: approve.body,
      });
      return NextResponse.json(
        {
          error: "approve_failed",
          message: approve.error,
          stage: "approve",
          body: approve.body,
        },
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
        body: release.body,
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
          body: release.body,
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
      fund_tx: fundResult.tx_hash ?? null,
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
      fund: fundResult,
      approve: approveResult,
      release: releaseResult,
    },
  });
}
