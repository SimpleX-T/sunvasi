import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: milestone } = await db.from("milestones").select("*, contracts!inner(*)").eq("id", id).single();
  if (!milestone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = (milestone as any).contracts;
  if (contract.client_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from("milestones")
    .update({ status: "released", approved_at: now, released_at: now })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("activity").insert({
    contract_id: contract.id,
    milestone_id: id,
    actor_id: user.did,
    type: "approved",
    metadata: { milestone_position: (milestone as { position: number }).position },
  });

  // Move the next pending milestone to in_progress so the dashboard updates.
  await db
    .from("milestones")
    .update({ status: "in_progress" })
    .eq("contract_id", contract.id)
    .eq("status", "pending")
    .eq("position", (milestone as { position: number }).position + 1);

  // If all milestones are released, mark contract completed.
  const { data: remaining } = await db
    .from("milestones")
    .select("status")
    .eq("contract_id", contract.id);
  const allDone = (remaining ?? []).every((r) => (r as { status: string }).status === "released");
  if (allDone) {
    await db
      .from("contracts")
      .update({ status: "completed", completed_at: now })
      .eq("id", contract.id);
  }

  return NextResponse.json({ milestone: updated });
}
