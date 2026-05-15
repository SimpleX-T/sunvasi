import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin, type ContractRow } from "@/lib/supabase";
import { ContractDraftSchema } from "@/lib/contract-schema";
import { logger } from "@/lib/logger";
import { notifyClientOfContract } from "@/lib/email";

/* ---------------------------------------------------------------------------
 * Single-contract endpoint: read, edit (while unfunded), delete (while
 * unfunded). Accepts either the UUID or the short_id in the URL.
 * ------------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

async function loadContract(id: string): Promise<ContractRow | null> {
  const db = supabaseAdmin();
  const isUuid = UUID_RE.test(id);
  const { data } = isUuid
    ? await db.from("contracts").select("*").eq("id", id).maybeSingle<ContractRow>()
    : await db.from("contracts").select("*").eq("short_id", id).maybeSingle<ContractRow>();
  return data;
}

function canMutate(status: string): boolean {
  return status === "draft" || status === "awaiting_funding";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const contract = await loadContract(id);
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ contract });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const contract = await loadContract(id);
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contract.freelancer_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!canMutate(contract.status)) {
    return NextResponse.json(
      { error: "locked", message: `Contracts can only be edited before funding (current: ${contract.status}).` },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = ContractDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const db = supabaseAdmin();

  const { error: updErr } = await db
    .from("contracts")
    .update({
      title: data.title,
      description: data.description ?? null,
      client_email: data.client_email,
      total_amount_usdc: data.total_amount_usdc,
      auto_release_days: data.auto_release_days,
    })
    .eq("id", contract.id);
  if (updErr) {
    logger.error("contract.update_failed", { message: updErr.message });
    return NextResponse.json({ error: "db_error", message: updErr.message }, { status: 500 });
  }

  // Replace milestones wholesale — simplest correct behaviour while in draft.
  const { error: delErr } = await db
    .from("milestones")
    .delete()
    .eq("contract_id", contract.id);
  if (delErr) {
    return NextResponse.json({ error: "db_error", message: delErr.message }, { status: 500 });
  }
  const rows = data.milestones.map((m, i) => ({
    contract_id: contract.id,
    position: i,
    title: m.title,
    description: m.description ?? null,
    acceptance_criteria: m.acceptance_criteria ?? null,
    amount_usdc: m.amount_usdc,
    status: "pending" as const,
  }));
  const { error: insErr } = await db.from("milestones").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: "db_error", message: insErr.message }, { status: 500 });
  }

  await db.from("activity").insert({
    contract_id: contract.id,
    actor_id: user.did,
    type: "edited",
    metadata: { milestones: data.milestones.length, total: data.total_amount_usdc },
  });

  // Best-effort: notify the client that the contract was updated.
  const notify = await notifyClientOfContract({
    contractId: contract.id,
    shortId: contract.short_id,
    contractTitle: data.title,
    totalUsdc: Number(data.total_amount_usdc),
    clientEmail: data.client_email,
    freelancerDid: user.did,
    db,
    mode: "updated",
    requestUrl: req.url,
  });
  if (notify.attempted && !notify.ok) {
    logger.warn("contract.update.notify_failed", { reason: notify.reason });
  }

  return NextResponse.json({ ok: true, short_id: contract.short_id, invite: notify });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(_req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const contract = await loadContract(id);
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contract.freelancer_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!canMutate(contract.status)) {
    return NextResponse.json(
      {
        error: "locked",
        message:
          `Funded contracts can't be deleted — they have funds in escrow. Resolve milestones or refund first (current: ${contract.status}).`,
      },
      { status: 409 },
    );
  }

  const db = supabaseAdmin();
  const { error } = await db.from("contracts").delete().eq("id", contract.id);
  if (error) {
    logger.error("contract.delete_failed", { message: error.message });
    return NextResponse.json({ error: "db_error", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
