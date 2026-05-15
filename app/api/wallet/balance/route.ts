import { NextResponse } from "next/server";
import { verifyUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ProfileRow } from "@/lib/supabase";
import { fetchAccount } from "@/lib/stellar-account";
import { USDC_ASSET_CODE, USDC_ISSUERS, getNetwork } from "@/lib/stellar";
import { processOverdueMilestones } from "@/lib/auto-release";
import { logger } from "@/lib/logger";

/* ---------------------------------------------------------------------------
 * Stellar wallet balance for the current signed-in user. Pulled live from
 * Horizon and normalised to: { usdc, xlm, address, network, fetched_at }.
 *
 * `not_provisioned`  → user has no Stellar wallet yet
 * `not_activated`    → wallet exists but isn't on-chain yet (no funding)
 * ------------------------------------------------------------------------ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await verifyUserFromHeaders(req.headers);
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Piggy-back the auto-release worker on the balance poll. While the
  // freelancer has /app/profile open this fires every ~20s and processes
  // any overdue milestones — keeping the demo "watch the balance tick up"
  // moment honest, with no separate cron infrastructure.
  void processOverdueMilestones(auth.did).catch((e) =>
    logger.warn("balance.auto_release_failed", {
      did: auth.did,
      message: e instanceof Error ? e.message : String(e),
    }),
  );

  const db = supabaseAdmin();
  const { data: profile } = await db
    .from("profiles")
    .select("payout_address")
    .eq("id", auth.did)
    .maybeSingle();
  const address = (profile as Pick<ProfileRow, "payout_address"> | null)?.payout_address;
  if (!address) {
    return NextResponse.json({
      state: "not_provisioned",
      address: null,
      usdc: null,
      xlm: null,
    });
  }

  const network = getNetwork();
  const usdcIssuer = USDC_ISSUERS[network];

  try {
    const account = await fetchAccount(address, network);
    if (!account) {
      return NextResponse.json({
        state: "not_activated",
        address,
        usdc: null,
        xlm: null,
        network,
        fetched_at: new Date().toISOString(),
      });
    }
    const usdcBalance = account.balances.find(
      (b) =>
        b.asset_code === USDC_ASSET_CODE && b.asset_issuer === usdcIssuer,
    );
    const xlmBalance = account.balances.find((b) => b.asset_type === "native");
    return NextResponse.json({
      state: "ok",
      address,
      network,
      usdc: usdcBalance
        ? {
            balance: usdcBalance.balance,
            issuer: usdcBalance.asset_issuer,
            // Trustline present is implied by being in balances.
            trustline: true,
          }
        : { balance: "0.0000000", issuer: usdcIssuer, trustline: false },
      xlm: { balance: xlmBalance?.balance ?? "0" },
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.warn("wallet.balance.fetch_failed", {
      did: auth.did,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      {
        state: "error",
        message: e instanceof Error ? e.message : "Horizon error",
      },
      { status: 502 },
    );
  }
}
