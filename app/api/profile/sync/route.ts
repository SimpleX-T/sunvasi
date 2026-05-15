import { NextResponse } from "next/server";
import { z } from "zod";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/logger";

const Body = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(80).optional(),
  avatar_url: z.string().url().optional(),
  wallet_address: z.string().optional(),
});

export async function POST(req: Request) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("profiles")
    .upsert(
      {
        id: user.did,
        email: parsed.data.email,
        display_name: parsed.data.display_name ?? null,
        avatar_url: parsed.data.avatar_url ?? null,
        payout_address: parsed.data.wallet_address ?? null,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) {
    logger.error("profile.sync_failed", { did: user.did, message: error.message });
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}
