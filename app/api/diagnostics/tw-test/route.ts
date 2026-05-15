import { NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import {
  getTrustlessWork,
  isTrustlessWorkConfigured,
} from "@/lib/trustless-work";
import { USDC_ISSUERS, getNetwork } from "@/lib/stellar";

/* ---------------------------------------------------------------------------
 * End-to-end Trustless Work smoke test.
 *
 *   • Generates 5 throwaway Stellar keypairs (we never use the secret keys —
 *     this only proves the TW REST + payload contract works).
 *   • Calls /deployer/multi-release with a 1 USDC test milestone.
 *   • A success returns `unsignedTransaction` — proof that TW would issue an
 *     escrow if a real signer were involved. We DO NOT broadcast.
 *
 *   This validates: API key, network reachability, payload schema, role model.
 *   It does NOT validate: the wallet-signing flow or on-chain settlement.
 * ------------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isTrustlessWorkConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        stage: "config",
        message:
          "TRUSTLESS_WORK_API_KEY is not set. Funding runs in mock mode.",
      },
      { status: 200 },
    );
  }

  const tw = getTrustlessWork();
  const network = getNetwork();
  const usdcIssuer = USDC_ISSUERS[network];

  // Throwaway keypairs — public keys only; we discard the secrets.
  // Optionally, the user can pin a real funded testnet address as the
  // platform party so the dry-run sails through TW's on-chain validation too.
  const platform =
    process.env.SUNVASI_DIAGNOSTIC_PLATFORM_ADDRESS ??
    Keypair.random().publicKey();
  const approver = Keypair.random().publicKey();
  const serviceProvider = Keypair.random().publicKey();
  const releaseSigner = Keypair.random().publicKey();
  const disputeResolver = Keypair.random().publicKey();

  const engagementId = `sunvasi_diag_${Date.now()}`;

  const started = Date.now();
  try {
    const result = await tw.initializeEscrow({
      signer: platform,
      engagementId,
      title: "Sunvasi diagnostic dry-run",
      description:
        "End-to-end probe from /app/diagnostics. No real funds; the unsigned XDR is discarded.",
      platformFee: 0,
      roles: {
        approver,
        serviceProvider,
        releaseSigner,
        disputeResolver,
        platformAddress: platform,
      },
      milestones: [
        {
          description: "Diagnostic test milestone",
          amount: 1,
          receiver: serviceProvider,
        },
      ],
      trustline: { address: usdcIssuer, symbol: "USDC" },
    });
    const latency = Date.now() - started;
    const hasXdr = Boolean(result?.unsignedTransaction);
    return NextResponse.json({
      ok: hasXdr,
      stage: hasXdr ? "complete" : "no_xdr_returned",
      latency_ms: latency,
      network,
      base_url: tw.baseUrl,
      engagement_id: engagementId,
      unsigned_xdr_preview: hasXdr
        ? `${String(result.unsignedTransaction).slice(0, 56)}…`
        : null,
      parties: {
        platform,
        approver,
        serviceProvider,
        releaseSigner,
        disputeResolver,
      },
      message: hasXdr
        ? "Trustless Work returned an unsigned transaction. Your TW integration is live."
        : "TW responded but did not include an unsignedTransaction. Inspect the raw response below.",
      raw: result,
    });
  } catch (e) {
    const latency = Date.now() - started;
    const err = e as { status?: number; body?: unknown; message?: string };
    const msg = String(err.message ?? "");

    // TW rejected the payload at the on-chain validation layer — but THAT means
    // auth + transport + schema all worked. We treat this as "integration
    // verified; on-chain prerequisites missing" rather than a real failure.
    const isOnChainValidation =
      err.status === 400 &&
      /trustline|account.*exist|reserve|balance/i.test(msg);

    if (isOnChainValidation) {
      return NextResponse.json({
        ok: true,
        stage: "integration_verified_payload_invalid_on_chain",
        latency_ms: latency,
        network,
        base_url: tw.baseUrl,
        engagement_id: engagementId,
        message:
          "Trustless Work is wired correctly. The dry-run payload was rejected because the throwaway test keypair isn't a real on-chain account — that's expected for a diagnostic. To run a fully passing test, set SUNVASI_DIAGNOSTIC_PLATFORM_ADDRESS to a funded testnet account with a USDC trustline.",
        validation_detail: msg,
        body: err.body ?? null,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        stage: "tw_request",
        latency_ms: latency,
        network,
        base_url: tw.baseUrl,
        engagement_id: engagementId,
        status: err.status,
        message: err.message ?? "Trustless Work request failed.",
        body: err.body ?? null,
      },
      { status: 200 },
    );
  }
}
