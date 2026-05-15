import { NextResponse } from "next/server";
import { verifyUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ProfileRow } from "@/lib/supabase";
import { ensureStellarWallet, isPrivyServerConfigured } from "@/lib/privy-server";
import { ensureFundableAccount } from "@/lib/stellar-account";
import { logger } from "@/lib/logger";

const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

/* ---------------------------------------------------------------------------
 * Force re-provision the current user's Privy Stellar wallet + on-chain
 * fundability (activation + USDC trustline). Surfaces every step's outcome so
 * the diagnostic page can show exactly what passed and what failed instead
 * of the silent best-effort logging in the normal profile-load path.
 *
 * Safe to call repeatedly — every step is idempotent.
 * ------------------------------------------------------------------------ */

interface StepResult {
  name: string;
  ok: boolean;
  detail?: string;
  data?: unknown;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await verifyUserFromHeaders(req.headers);
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isPrivyServerConfigured()) {
    return NextResponse.json(
      { error: "privy_not_configured", message: "PRIVY_APP_SECRET is required" },
      { status: 503 },
    );
  }

  // ?force=1 wipes the stored wallet ID even if the address looks Stellar.
  // Needed when the existing wallet was created with `owner: { user_id: … }`
  // and now returns 401 on raw_sign because Privy expects an authorization
  // signature we can't easily produce. Force re-provision creates a fresh
  // app-owned wallet that we CAN sign with via Basic auth alone.
  const force = new URL(req.url).searchParams.get("force") === "1";

  const steps: StepResult[] = [];
  const db = supabaseAdmin();

  // Step 1 — clean up the existing wallet binding. Always nuke when ?force=1;
  // otherwise only nuke if the address isn't a valid Stellar G... key.
  let profile: ProfileRow | null = null;
  let priorWalletId: string | null = null;
  try {
    const { data } = await db
      .from("profiles")
      .select("*")
      .eq("id", auth.did)
      .maybeSingle<ProfileRow>();
    profile = data;
    priorWalletId = data?.stellar_wallet_id ?? null;
    const oldAddress = data?.payout_address ?? "";
    const shouldClear =
      force || (oldAddress.length > 0 && !STELLAR_ADDR_RE.test(oldAddress));
    if (shouldClear && (oldAddress || priorWalletId)) {
      await db
        .from("profiles")
        .update({ payout_address: null, stellar_wallet_id: null })
        .eq("id", auth.did);
      steps.push({
        name: "clear_existing_wallet",
        ok: true,
        detail: force
          ? `Force-cleared wallet binding (was ${oldAddress.slice(0, 10)}…). A fresh app-owned wallet will be created.`
          : `Cleared non-Stellar payout_address (${oldAddress.slice(0, 10)}…)`,
      });
    }
  } catch (e) {
    steps.push({
      name: "load_profile",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Step 2 — ensure Privy Stellar wallet exists. Force mode discards any
  // existing wallet ID so a fresh one is created.
  let walletId: string | undefined;
  let address: string | undefined;
  try {
    const wallet = await ensureStellarWallet(auth.did, force ? null : priorWalletId);
    walletId = wallet.id;
    address = wallet.address;
    await db
      .from("profiles")
      .upsert(
        {
          id: auth.did,
          email: profile?.email ?? "unknown@sunvasi.local",
          stellar_wallet_id: wallet.id,
          payout_address: wallet.address,
        },
        { onConflict: "id" },
      );
    steps.push({
      name: "privy_stellar_wallet",
      ok: true,
      detail: `${wallet.address.slice(0, 10)}…${wallet.address.slice(-6)}`,
      data: { wallet_id: wallet.id, address: wallet.address },
    });
  } catch (e) {
    steps.push({
      name: "privy_stellar_wallet",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Step 3 — activate + trustline on-chain.
  if (walletId && address) {
    try {
      const result = await ensureFundableAccount({ walletId, address });
      steps.push({
        name: "stellar_account_ready",
        ok: true,
        detail: result.already_ready
          ? "Already activated + USDC trustline present"
          : `${result.activated ? "Activated via Friendbot. " : ""}${result.trustline_established ? `USDC trustline established (tx ${result.trustline_tx_hash?.slice(0, 16)}…).` : ""}`.trim(),
        data: result,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.warn("reprovision.fundable_failed", { did: auth.did, message });
      steps.push({
        name: "stellar_account_ready",
        ok: false,
        detail: message,
      });
    }
  }

  const allOk = steps.every((s) => s.ok);
  return NextResponse.json({
    ok: allOk,
    did: auth.did,
    address,
    steps,
  });
}
