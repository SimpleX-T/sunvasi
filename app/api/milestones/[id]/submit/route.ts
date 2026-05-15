import { NextResponse } from "next/server";
import { readUserFromHeaders } from "@/lib/privy";
import { supabaseAdmin } from "@/lib/supabase";
import { SubmitDeliverableSchema } from "@/lib/contract-schema";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = readUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = SubmitDeliverableSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: milestone } = await db.from("milestones").select("*, contracts!inner(*)").eq("id", id).single();
  if (!milestone) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contract = (milestone as any).contracts;
  if (contract.freelancer_id !== user.did) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const autoReleaseAt = new Date(now.getTime() + (contract.auto_release_days ?? 7) * 24 * 3600 * 1000);

  const { data: updated, error } = await db
    .from("milestones")
    .update({
      status: "submitted",
      deliverable_files: parsed.data.files,
      deliverable_links: parsed.data.links,
      deliverable_note: parsed.data.note,
      submitted_at: now.toISOString(),
      auto_release_at: autoReleaseAt.toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("activity").insert({
    contract_id: contract.id,
    milestone_id: id,
    actor_id: user.did,
    type: "submitted",
    metadata: { milestone_position: (milestone as { position: number }).position },
  });

  return NextResponse.json({ milestone: updated });
}
