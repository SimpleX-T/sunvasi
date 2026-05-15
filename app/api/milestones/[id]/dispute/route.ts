import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabase";
import { DisputeEvidenceSchema } from "@/lib/contract-schema";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = DisputeEvidenceSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: milestone } = await db.from("milestones").select("*, contracts!inner(*)").eq("id", id).single();
  if (!milestone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = (milestone as any).contracts;
  const role = contract.client_id === user.did ? "client" : contract.freelancer_id === user.did ? "freelancer" : null;
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.from("milestones").update({ status: "disputed" }).eq("id", id);
  await db.from("contracts").update({ status: "disputed" }).eq("id", contract.id);

  const evidenceColumn = role === "client" ? "client_evidence" : "freelancer_evidence";

  const { data: existing } = await db.from("disputes").select("*").eq("milestone_id", id).maybeSingle();
  let dispute = existing;
  if (!dispute) {
    const { data: created, error } = await db
      .from("disputes")
      .insert({
        milestone_id: id,
        contract_id: contract.id,
        filed_by: user.did,
        [evidenceColumn]: parsed.data,
        status: "evidence_collection",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    dispute = created;
  } else {
    await db.from("disputes").update({ [evidenceColumn]: parsed.data }).eq("id", (dispute as { id: string }).id);
  }

  await db.from("activity").insert({
    contract_id: contract.id,
    milestone_id: id,
    actor_id: user.did,
    type: "disputed",
    metadata: { role, milestone_position: (milestone as { position: number }).position },
  });

  return NextResponse.json({ dispute });
}
