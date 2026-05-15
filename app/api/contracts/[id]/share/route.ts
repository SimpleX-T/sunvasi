import { NextResponse } from "next/server";
import { z } from "zod";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ContractRow, type ProfileRow } from "@/lib/supabase";
import { isEmailConfigured, sendContractInvite } from "@/lib/email";
import { logger } from "@/lib/logger";

/* ---------------------------------------------------------------------------
 * Sharing controls.
 *
 *   POST /api/contracts/[id]/share
 *     body: {
 *       visibility?: "public" | "restricted",
 *       invitee_emails?: string[],        // replaces the whole list
 *       send_to?: string[],               // optional: send invite emails now
 *     }
 *
 *   Only the freelancer owner can change sharing. Sending invite emails
 *   requires Resend to be configured; otherwise the recipients are still
 *   added to the allowlist but no email is sent.
 * ------------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Body = z.object({
  visibility: z.enum(["public", "restricted"]).optional(),
  invitee_emails: z.array(z.string().email()).max(50).optional(),
  send_to: z.array(z.string().email()).max(20).optional(),
});

function normalizeEmails(emails: string[]): string[] {
  return Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))));
}

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
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch: { visibility?: string; invitee_emails?: string[] } = {};
  if (parsed.data.visibility) patch.visibility = parsed.data.visibility;
  if (parsed.data.invitee_emails) {
    patch.invitee_emails = normalizeEmails(parsed.data.invitee_emails);
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("contracts").update(patch).eq("id", contract.id);
    if (error) {
      logger.error("contract.share_update_failed", { message: error.message });
      return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
    }
  }

  // Optionally send invitation emails to the requested addresses.
  const sendResults: Array<{ to: string; ok: boolean; error?: string }> = [];
  if (parsed.data.send_to && parsed.data.send_to.length > 0) {
    if (!isEmailConfigured()) {
      sendResults.push(
        ...parsed.data.send_to.map((to) => ({
          to,
          ok: false,
          error: "Server email not configured. Share the link manually.",
        })),
      );
    } else {
      const { data: profile } = await db
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.did)
        .maybeSingle<Pick<ProfileRow, "display_name" | "email">>();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
      const freelancerName = profile?.display_name ?? profile?.email ?? "A freelancer";

      for (const to of normalizeEmails(parsed.data.send_to)) {
        try {
          const result = await sendContractInvite({
            to,
            contractTitle: contract.title,
            freelancerName,
            totalUsdc: Number(contract.total_amount_usdc),
            shortId: contract.short_id,
            appUrl,
          });
          if (result.error) {
            sendResults.push({ to, ok: false, error: result.error.message });
          } else {
            sendResults.push({ to, ok: true });
            await db.from("activity").insert({
              contract_id: contract.id,
              actor_id: user.did,
              type: "invited",
              metadata: { to, provider: "resend", id: result.data?.id ?? null },
            });
          }
        } catch (e) {
          sendResults.push({
            to,
            ok: false,
            error: e instanceof Error ? e.message : "send_failed",
          });
        }
      }
    }
  }

  // Refetch the updated contract for the client.
  const { data: updated } = await db
    .from("contracts")
    .select("visibility, invitee_emails")
    .eq("id", contract.id)
    .maybeSingle<Pick<ContractRow, "visibility" | "invitee_emails">>();

  return NextResponse.json({
    ok: true,
    visibility: updated?.visibility ?? contract.visibility,
    invitee_emails: updated?.invitee_emails ?? contract.invitee_emails,
    send_results: sendResults,
  });
}
