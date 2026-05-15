import { NextResponse } from "next/server";
import { verifyUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ContractRow, type MilestoneRow, type ProfileRow } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getTrustlessWork, isTrustlessWorkConfigured } from "@/lib/trustless-work";
import {
  ensureStellarWallet,
  getVerifiedEmailsForUser,
  isPrivyServerConfigured,
  rawSignHash,
} from "@/lib/privy-server";
import { ensureFundableAccount } from "@/lib/stellar-account";
import { prepareForSigning, attachRawSignature, toSignedXdr } from "@/lib/stellar-tx";
import { USDC_ISSUERS, getNetwork, isStellarAddress } from "@/lib/stellar";

/* ---------------------------------------------------------------------------
 * Funding endpoint.
 *
 *   Three operating modes:
 *
 *   1. MOCK  — when TRUSTLESS_WORK_API_KEY is absent. The contract is flipped
 *              to `active` locally; no Stellar transaction happens.
 *
 *   2. ON-CHAIN with Privy server signer — when TW + Privy server creds are
 *              both present AND both parties have Stellar wallet IDs:
 *                a. POST /deployer/multi-release → unsigned XDR
 *                b. parse XDR → compute hash
 *                c. POST /v1/wallets/{client_wallet_id}/raw_sign  (Privy)
 *                d. attach DecoratedSignature to envelope
 *                e. POST /helper/send-transaction (TW broadcast)
 *              Returns the on-chain contract address as escrow_id.
 *
 *   3. NOT-READY — when TW is configured but a required Privy wallet is
 *              missing. Returns 412 with a clear message so the UI can prompt
 *              the user to complete onboarding.
 *
 *   Restricted-visibility access check applies in every mode.
 * ------------------------------------------------------------------------ */

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await verifyUserFromHeaders(req.headers);
  const user = auth ? { did: auth.did } : null;
  const db = supabaseAdmin();

  const { data: contract } = await db
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle<ContractRow>();
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // ── Access check for restricted contracts ──────────────────────────────
  // The caller's email comes from Privy's verified linked accounts, never
  // from the request body. This prevents a client from passing an arbitrary
  // email to bypass the invite list.
  let verifiedEmails: string[] = [];
  if (contract.visibility === "restricted") {
    if (!auth) {
      return NextResponse.json(
        { error: "unauthenticated", message: "This contract is restricted — sign in to fund." },
        { status: 401 },
      );
    }
    try {
      verifiedEmails = await getVerifiedEmailsForUser(auth.did);
    } catch (e) {
      logger.warn("fund.email_lookup_failed", {
        did: auth.did,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    const allowed = new Set<string>();
    if (contract.client_email) allowed.add(contract.client_email.toLowerCase());
    for (const e of contract.invitee_emails ?? []) allowed.add(e.toLowerCase());
    const ok = verifiedEmails.some((e) => allowed.has(e));
    if (!ok) {
      return NextResponse.json(
        {
          error: "not_invited",
          message:
            "This contract is restricted. Ask the freelancer to invite the email address linked to your account.",
        },
        { status: 403 },
      );
    }
  }

  // First-time funding: bind client_id / client_email so future operations
  // know who paid. Email also comes from Privy verification — never trusted
  // from the body.
  if (user && !contract.client_id) {
    await db.from("contracts").update({ client_id: user.did }).eq("id", id);
  }
  if (auth && !contract.client_email) {
    if (verifiedEmails.length === 0) {
      try {
        verifiedEmails = await getVerifiedEmailsForUser(auth.did);
      } catch {
        // ignore — we just won't backfill client_email
      }
    }
    if (verifiedEmails[0]) {
      await db.from("contracts").update({ client_email: verifiedEmails[0] }).eq("id", id);
    }
  }

  const isMock = !isTrustlessWorkConfigured();
  if (isMock) {
    return mockFund({ contract, user, db });
  }

  // ── Real on-chain funding requires a Privy wallet for the signer ──────
  if (!user) {
    return NextResponse.json(
      { error: "unauthenticated", message: "Sign in to fund this contract on-chain." },
      { status: 401 },
    );
  }
  if (!isPrivyServerConfigured()) {
    return NextResponse.json(
      {
        error: "privy_not_configured",
        message:
          "On-chain funding requires PRIVY_APP_SECRET. Either set it or unset TRUSTLESS_WORK_API_KEY to fall back to mock funding.",
      },
      { status: 503 },
    );
  }

  return onChainFund({ contract, user, db });
}

/* ------------------------------------------------------------------------- */
/* Mode 1: mock fund                                                          */
/* ------------------------------------------------------------------------- */

interface MockArgs {
  contract: ContractRow;
  user: { did: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

async function mockFund({ contract, user, db }: MockArgs) {
  const fakeEscrowId = `mock_${contract.id.slice(0, 8)}`;
  await db
    .from("contracts")
    .update({
      status: "active",
      escrow_id: fakeEscrowId,
      escrow_address: fakeEscrowId,
      funded_at: new Date().toISOString(),
    })
    .eq("id", contract.id);
  await db
    .from("milestones")
    .update({ status: "in_progress" })
    .eq("contract_id", contract.id)
    .eq("position", 0);
  await db.from("activity").insert({
    contract_id: contract.id,
    actor_id: user?.did ?? null,
    type: "funded",
    metadata: { mock: true, amount: contract.total_amount_usdc },
  });
  logger.info("contract.funded.mock", { contract_id: contract.id });
  return NextResponse.json({ status: "active", mock: true, escrow_id: fakeEscrowId });
}

/* ------------------------------------------------------------------------- */
/* Mode 2: on-chain via TW + Privy raw-sign                                   */
/* ------------------------------------------------------------------------- */

interface OnChainArgs {
  contract: ContractRow;
  user: { did: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/** Provision a Stellar wallet for `did` if missing AND make it on-chain
 * fundable (activate + USDC trustline). Returns the wallet + a record of
 * what was done. Throws with a clear message on hard failure. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function prepareWallet(did: string, role: string, db: any) {
  // 1. Ensure Privy Stellar wallet exists.
  const wallet = await ensureStellarWallet(did);
  if (!wallet?.id || !wallet.address || !isStellarAddress(wallet.address)) {
    throw new Error(`Privy returned no Stellar wallet for ${role} (${did}).`);
  }

  // 2. Cache to profile (preserve email if present).
  const { data: existing } = await db
    .from("profiles")
    .select("email, payout_address")
    .eq("id", did)
    .maybeSingle();
  const email = (existing as { email?: string } | null)?.email ?? `${role}@sunvasi.local`;
  const oldAddress = (existing as { payout_address?: string } | null)?.payout_address ?? null;
  // If the stored address is non-Stellar, overwrite. If it was already the
  // new Stellar one this is a no-op.
  if (oldAddress !== wallet.address) {
    await db
      .from("profiles")
      .upsert(
        { id: did, email, stellar_wallet_id: wallet.id, payout_address: wallet.address },
        { onConflict: "id" },
      );
  }

  // 3. Activate + trustline. Idempotent: short-circuits when already ready.
  const fundable = await ensureFundableAccount({
    walletId: wallet.id,
    address: wallet.address,
  });

  return { wallet, fundable };
}

async function onChainFund({ contract, user, db }: OnChainArgs) {
  if (!user) {
    return NextResponse.json(
      { error: "unauthenticated", message: "Sign in to fund this contract on-chain." },
      { status: 401 },
    );
  }

  // 1. Ensure the client (caller) has a fundable Stellar wallet.
  let clientWallet: { id: string; address: string };
  try {
    const { wallet, fundable } = await prepareWallet(user.did, "client", db);
    clientWallet = { id: wallet.id, address: wallet.address };
    logger.info("fund.client_wallet_ready", {
      did: user.did,
      address: wallet.address,
      activated: fundable.activated,
      trustline_established: fundable.trustline_established,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("fund.client_wallet_failed", { did: user.did, message });
    return NextResponse.json(
      {
        error: "wallet_provision_failed",
        message: `Could not prepare your Stellar wallet: ${message}`,
      },
      { status: 502 },
    );
  }

  // 2. Same for the freelancer (receiver) — the server provisions on their
  //    behalf if they haven't signed in yet, so funding doesn't block on
  //    asking the freelancer to do anything.
  if (!contract.freelancer_id) {
    return NextResponse.json(
      { error: "no_freelancer", message: "Contract has no freelancer owner." },
      { status: 412 },
    );
  }
  let freelancer: ProfileRow;
  try {
    const { wallet, fundable } = await prepareWallet(
      contract.freelancer_id,
      "freelancer",
      db,
    );
    logger.info("fund.freelancer_wallet_ready", {
      did: contract.freelancer_id,
      address: wallet.address,
      activated: fundable.activated,
      trustline_established: fundable.trustline_established,
    });
    // Refetch the profile with its new wallet info for downstream use.
    const { data } = await db
      .from("profiles")
      .select("*")
      .eq("id", contract.freelancer_id)
      .maybeSingle();
    freelancer = data as ProfileRow;
    if (!freelancer || !freelancer.payout_address || !isStellarAddress(freelancer.payout_address)) {
      throw new Error("Freelancer profile is missing a Stellar payout_address after provisioning.");
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("fund.freelancer_wallet_failed", {
      did: contract.freelancer_id,
      message,
    });
    return NextResponse.json(
      {
        error: "freelancer_wallet_failed",
        message: `Could not prepare the freelancer's Stellar wallet: ${message}`,
      },
      { status: 502 },
    );
  }

  // 3. Load milestones — needed for the TW payload.
  const { data: milestones } = await db
    .from("milestones")
    .select("*")
    .eq("contract_id", contract.id)
    .order("position", { ascending: true });
  const ms = (milestones ?? []) as MilestoneRow[];
  if (ms.length === 0) {
    return NextResponse.json(
      { error: "no_milestones", message: "Contract has no milestones to escrow." },
      { status: 412 },
    );
  }

  const network = getNetwork();
  const usdcIssuer = USDC_ISSUERS[network];
  const tw = getTrustlessWork();

  // 4. Initialize escrow on TW. Roles: client = approver + releaseSigner,
  //    freelancer = serviceProvider + receiver, platform = client wallet
  //    (the caller funds + receives any refunds). Dispute resolver is the
  //    Sunvasi-controlled signer — for now we re-use platform until a
  //    dedicated resolver wallet is configured.
  let unsignedXdr: string;
  try {
    const result = await tw.initializeEscrow({
      signer: clientWallet.address,
      engagementId: contract.short_id,
      title: contract.title,
      description: contract.description ?? `Sunvasi contract ${contract.short_id}`,
      platformFee: 0,
      roles: {
        approver: clientWallet.address,
        serviceProvider: freelancer.payout_address,
        releaseSigner: clientWallet.address,
        disputeResolver: clientWallet.address,
        platformAddress: clientWallet.address,
      },
      milestones: ms.map((m) => ({
        description: m.title,
        amount: Number(m.amount_usdc),
        receiver: freelancer.payout_address!,
      })),
      trustline: { address: usdcIssuer, symbol: "USDC" },
    });
    if (!result?.unsignedTransaction) {
      throw new Error("TW returned no unsignedTransaction");
    }
    unsignedXdr = result.unsignedTransaction;
  } catch (e) {
    const err = e as { status?: number; body?: unknown; message?: string };
    logger.error("fund.tw_initialize_failed", {
      contract_id: contract.id,
      status: err.status,
      message: err.message,
    });
    return NextResponse.json(
      {
        error: "tw_initialize_failed",
        message: err.message ?? "Trustless Work rejected the escrow.",
        body: err.body ?? null,
      },
      { status: 502 },
    );
  }

  // 5. Hash the unsigned XDR.
  let signedXdr: string;
  try {
    const { tx, hashHex } = prepareForSigning(unsignedXdr, network);
    // 6. Privy raw-signs the hash.
    const signatureHex = await rawSignHash(clientWallet.id, hashHex);
    // 7. Attach the signature and serialise.
    attachRawSignature(tx, clientWallet.address, signatureHex);
    signedXdr = toSignedXdr(tx);
  } catch (e) {
    logger.error("fund.signing_failed", {
      contract_id: contract.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "signing_failed", message: e instanceof Error ? e.message : "Signing failed." },
      { status: 502 },
    );
  }

  // 8. Broadcast via TW.
  let txHash: string | null = null;
  let escrowContractId: string | null = null;
  try {
    const result = await tw.sendTransaction({ signedXdr, returnEscrowDataIsRequired: true });
    txHash = result?.hash ?? null;
    escrowContractId = result?.contractId ?? null;
    if (!escrowContractId && result?.escrow && typeof result.escrow === "object") {
      const e = result.escrow as Record<string, unknown>;
      escrowContractId = (e.contractId as string) ?? (e.id as string) ?? null;
    }
  } catch (e) {
    const err = e as { status?: number; body?: unknown; message?: string };
    logger.error("fund.broadcast_failed", {
      contract_id: contract.id,
      message: err.message,
    });
    return NextResponse.json(
      {
        error: "broadcast_failed",
        message: err.message ?? "Network broadcast failed.",
        body: err.body ?? null,
      },
      { status: 502 },
    );
  }

  // 9. Persist + activity.
  await db
    .from("contracts")
    .update({
      status: "active",
      escrow_id: escrowContractId,
      escrow_address: escrowContractId,
      escrow_network: network,
      funded_at: new Date().toISOString(),
    })
    .eq("id", contract.id);
  await db
    .from("milestones")
    .update({ status: "in_progress" })
    .eq("contract_id", contract.id)
    .eq("position", 0);
  await db.from("activity").insert({
    contract_id: contract.id,
    actor_id: user.did,
    type: "funded",
    metadata: {
      on_chain: true,
      tx_hash: txHash,
      escrow_contract_id: escrowContractId,
      amount: contract.total_amount_usdc,
    },
  });

  logger.info("contract.funded.on_chain", {
    contract_id: contract.id,
    escrow_contract_id: escrowContractId,
    tx_hash: txHash,
  });
  return NextResponse.json({
    status: "active",
    mock: false,
    escrow_id: escrowContractId,
    tx_hash: txHash,
  });
}
