import { NextResponse } from "next/server";
import { z } from "zod";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ContractRow, type ProfileRow } from "@/lib/supabase";
import { isEmailConfigured, sendContractInvite } from "@/lib/email";
import { logger } from "@/lib/logger";

const Body = z.object({
  to: z.string().email().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const isUuid = UUID_RE.test(id);
  const { data: contract } = isUuid
    ? await db.from("contracts").select("*").eq("id", id).maybeSingle<ContractRow>()
    : await db.from("contracts").select("*").eq("short_id", id).maybeSingle<ContractRow>();
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contract.freelancer_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const to = parsed.data.to ?? contract.client_email;
  if (!to) {
    return NextResponse.json({ error: "no_recipient" }, { status: 400 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { ok: false, mode: "unconfigured", message: "Server email not configured. Use the Copy link button." },
      { status: 503 },
    );
  }

  // Look up freelancer's display name for the email body.
  const { data: profile } = await db
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.did)
    .maybeSingle<Pick<ProfileRow, "display_name" | "email">>();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  try {
    const result = await sendContractInvite({
      to,
      contractTitle: contract.title,
      freelancerName: profile?.display_name ?? profile?.email ?? "A freelancer",
      totalUsdc: Number(contract.total_amount_usdc),
      shortId: contract.short_id,
      appUrl,
    });
    if (result.error) {
      logger.error("contract.send_failed", { message: result.error.message });
      return NextResponse.json(
        { ok: false, mode: "resend", message: result.error.message },
        { status: 502 },
      );
    }
    await db.from("activity").insert({
      contract_id: contract.id,
      actor_id: user.did,
      type: "invited",
      metadata: { to, provider: "resend", id: result.data?.id ?? null },
    });
    await db
      .from("contracts")
      .update({ client_email: to })
      .eq("id", contract.id);
    return NextResponse.json({ ok: true, mode: "resend", id: result.data?.id ?? null });
  } catch (e) {
    logger.error("contract.send_threw", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, mode: "resend", message: "send_failed" }, { status: 502 });
  }
}
