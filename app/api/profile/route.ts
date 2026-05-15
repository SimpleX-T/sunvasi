import { NextResponse } from "next/server";
import { z } from "zod";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ProfileRow } from "@/lib/supabase";
import { ensureStellarWallet, isPrivyServerConfigured } from "@/lib/privy-server";
import { ensureFundableAccount } from "@/lib/stellar-account";
import { logger } from "@/lib/logger";

/* ---------------------------------------------------------------------------
 * Profile read + update for the current Privy user.
 *
 *   GET    → returns the profile row (lazy-creates one with the user's email
 *            if it doesn't exist).
 *   PATCH  → partial update of profile fields the user is allowed to touch.
 *
 *   Both endpoints idempotently provision a Privy embedded Stellar wallet for
 *   the user when PRIVY_APP_SECRET is configured. The wallet's address is
 *   stored as `profiles.payout_address`; the wallet ID (needed for raw
 *   signing) lives in `profiles.stellar_wallet_id`.
 * ------------------------------------------------------------------------ */

const PatchSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
  bio: z.string().max(1200).optional().nullable(),
  role: z.enum(["freelancer", "client", "both"]).optional(),
  skills: z.array(z.string().min(1).max(40)).max(20).optional(),
  hourly_rate_usdc: z.coerce.number().nonnegative().max(10_000).optional().nullable(),
  portfolio_links: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        url: z.string().url(),
      }),
    )
    .max(10)
    .optional(),
  country: z.string().max(80).optional().nullable(),
  payout_address: z.string().max(80).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  email: z.string().email().optional(),
  mark_onboarded: z.boolean().optional(),
});

/** Best-effort: ensure the profile row has a Stellar wallet AND the wallet
 * is activated on-chain with a USDC trustline. Sponsorship covers the user's
 * reserves on testnet (Friendbot) so they never need to touch XLM. Mainnet
 * sponsorship awaits a configured treasury account.
 *
 * Never throws — wallet provisioning failures shouldn't block profile
 * reads/writes. */
async function ensureWalletForProfile(profile: ProfileRow): Promise<ProfileRow> {
  if (!isPrivyServerConfigured()) return profile;

  // Step 1 — wallet exists in Privy.
  let walletId = profile.stellar_wallet_id;
  let address = profile.payout_address;
  if (!walletId || !address) {
    try {
      const wallet = await ensureStellarWallet(profile.id, profile.stellar_wallet_id);
      if (!wallet?.id || !wallet?.address) return profile;
      walletId = wallet.id;
      address = wallet.address;
      const db = supabaseAdmin();
      const { data: updated } = await db
        .from("profiles")
        .update({
          stellar_wallet_id: walletId,
          payout_address: address,
        })
        .eq("id", profile.id)
        .select()
        .single<ProfileRow>();
      profile = (updated as ProfileRow) ?? profile;
      logger.info("profile.stellar_wallet_provisioned", {
        did: profile.id,
        wallet_id: walletId,
        address,
      });
    } catch (e) {
      logger.warn("profile.stellar_wallet_provision_failed", {
        did: profile.id,
        message: e instanceof Error ? e.message : String(e),
      });
      return profile;
    }
  }

  // Step 2 — make the wallet fundable (activate + USDC trustline).
  // Sunvasi sponsors these reserves so the user never sees XLM.
  if (walletId && address) {
    try {
      const result = await ensureFundableAccount({ walletId, address });
      if (result.activated || result.trustline_established) {
        logger.info("profile.stellar_account_prepared", {
          did: profile.id,
          activated: result.activated,
          trustline_established: result.trustline_established,
        });
      }
    } catch (e) {
      logger.warn("profile.stellar_account_prepare_failed", {
        did: profile.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return profile;
}

export async function GET(req: Request) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const seedEmail = url.searchParams.get("email") ?? undefined;
  const seedDisplay = url.searchParams.get("display_name") ?? undefined;

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.did)
    .maybeSingle<ProfileRow>();

  if (existing) {
    const enriched = await ensureWalletForProfile(existing);
    return NextResponse.json({ profile: enriched });
  }

  if (!seedEmail) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  const { data: created, error } = await db
    .from("profiles")
    .insert({
      id: user.did,
      email: seedEmail,
      display_name: seedDisplay ?? null,
      role: "freelancer",
    })
    .select()
    .single<ProfileRow>();
  if (error || !created) {
    logger.error("profile.lazy_create_failed", { did: user.did, message: error?.message });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  const enriched = await ensureWalletForProfile(created);
  return NextResponse.json({ profile: enriched });
}

export async function PATCH(req: Request) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.mark_onboarded) {
    patch.onboarded_at = new Date().toISOString();
  }
  delete patch.mark_onboarded;

  if (parsed.data.email) {
    // Lazy-create on first PATCH if profile is missing.
    const { data: exists } = await db
      .from("profiles")
      .select("id")
      .eq("id", user.did)
      .maybeSingle();
    if (!exists) {
      await db.from("profiles").insert({
        id: user.did,
        email: parsed.data.email,
      });
    }
  }
  delete patch.email;

  const { data, error } = await db
    .from("profiles")
    .update(patch)
    .eq("id", user.did)
    .select()
    .single<ProfileRow>();
  if (error || !data) {
    logger.error("profile.update_failed", { did: user.did, message: error?.message });
    return NextResponse.json({ error: "db_error", message: error?.message }, { status: 500 });
  }
  const enriched = await ensureWalletForProfile(data);
  return NextResponse.json({ profile: enriched });
}
