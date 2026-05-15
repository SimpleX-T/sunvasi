import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabase";
import { ContractDraftSchema } from "@/lib/contract-schema";
import { shortId } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { notifyClientOfContract } from "@/lib/email";

interface ErrorWithCause {
  message?: string;
  name?: string;
  cause?: { code?: string; errno?: number; syscall?: string; hostname?: string; message?: string };
  code?: string;
  details?: string;
  hint?: string;
}

function describeError(err: unknown): Record<string, unknown> {
  if (!err) return { message: "unknown" };
  const e = err as ErrorWithCause;
  const out: Record<string, unknown> = {
    message: e.message,
    name: e.name,
  };
  if (e.code) out.code = e.code;
  if (e.details) out.details = e.details;
  if (e.hint) out.hint = e.hint;
  if (e.cause) {
    out.cause = {
      code: e.cause.code,
      syscall: e.cause.syscall,
      hostname: e.cause.hostname,
      message: e.cause.message,
    };
  }
  return out;
}

export async function POST(req: Request) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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
  const sid = shortId(8);

  let contract: { id: string; short_id: string } | null = null;
  let insertError: unknown = null;
  try {
    const result = await db
      .from("contracts")
      .insert({
        short_id: sid,
        title: data.title,
        description: data.description ?? null,
        client_email: data.client_email,
        freelancer_id: user.did,
        total_amount_usdc: data.total_amount_usdc,
        auto_release_days: data.auto_release_days,
        status: "awaiting_funding",
      })
      .select()
      .single();
    contract = result.data as { id: string; short_id: string } | null;
    insertError = result.error;
  } catch (e) {
    insertError = e;
  }

  if (insertError || !contract) {
    const described = describeError(insertError);
    logger.error("contract.create_failed", described);
    const httpStatus =
      (described.cause as { code?: string } | undefined)?.code === "ENOTFOUND" ||
      String(described.message ?? "").includes("fetch failed")
        ? 502
        : 500;
    return NextResponse.json(
      {
        error: "db_error",
        message: String(described.message ?? "Unknown database error"),
        hint:
          httpStatus === 502
            ? "Could not reach Supabase. Check that the project is awake and NEXT_PUBLIC_SUPABASE_URL is correct."
            : undefined,
      },
      { status: httpStatus },
    );
  }

  const milestonesRows = data.milestones.map((m, i) => ({
    contract_id: contract!.id,
    position: i,
    title: m.title,
    description: m.description ?? null,
    acceptance_criteria: m.acceptance_criteria ?? null,
    amount_usdc: m.amount_usdc,
    status: "pending" as const,
  }));
  const { error: mErr } = await db.from("milestones").insert(milestonesRows);
  if (mErr) {
    logger.error("contract.milestones_failed", { message: mErr.message });
    return NextResponse.json({ error: "db_error", message: mErr.message }, { status: 500 });
  }

  await db.from("activity").insert({
    contract_id: contract!.id,
    actor_id: user.did,
    type: "created",
    metadata: { title: data.title, total: data.total_amount_usdc },
  });

  // Best-effort: notify the client by email. Doesn't block the response.
  const notify = await notifyClientOfContract({
    contractId: contract!.id,
    shortId: contract!.short_id,
    contractTitle: data.title,
    totalUsdc: Number(data.total_amount_usdc),
    clientEmail: data.client_email,
    freelancerDid: user.did,
    db,
    mode: "new",
    requestUrl: req.url,
  });
  if (notify.attempted && !notify.ok) {
    logger.warn("contract.create.notify_failed", { reason: notify.reason });
  }

  return NextResponse.json({ contract, invite: notify });
}

export async function GET(req: Request) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("contracts")
    .select("*")
    .or(`freelancer_id.eq.${user.did},client_id.eq.${user.did}`)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}
