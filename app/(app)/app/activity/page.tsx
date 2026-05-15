import Link from "next/link";
import { Topbar } from "@/components/shell/topbar";
import { ActivityTimeline } from "@/components/contract/activity-timeline";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin, type ActivityRow } from "@/lib/supabase";

export default async function ActivityPage() {
  const user = await getCurrentUser().catch(() => null);
  let activity: ActivityRow[] = [];
  if (user) {
    try {
      const db = supabaseAdmin();
      const { data } = await db
        .from("contracts")
        .select("id")
        .or(`freelancer_id.eq.${user.did},client_id.eq.${user.did}`);
      const contractIds = (data ?? []).map((c) => (c as { id: string }).id);
      if (contractIds.length > 0) {
        const { data: a } = await db
          .from("activity")
          .select("*")
          .in("contract_id", contractIds)
          .order("created_at", { ascending: false })
          .limit(50);
        activity = (a ?? []) as ActivityRow[];
      }
    } catch {
      activity = [];
    }
  }

  return (
    <>
      <Topbar label="Activity" />
      <div className="flex-1 mx-auto w-full max-w-[820px] px-6 lg:px-10 py-10 lg:py-14">
        <header className="mb-10">
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">Activity</h1>
          <p className="mt-2 text-body-sm text-fg-muted">
            Every event across your contracts. Most recent first.
          </p>
        </header>
        <div className="rounded-lg border border-border bg-bg-elevated p-6">
          <ActivityTimeline events={activity} />
          {activity.length === 0 ? (
            <p className="mt-2 text-body-sm text-fg-subtle">
              Once contracts are funded, activity will land here.{" "}
              <Link href="/app/contracts/new" className="text-accent hover:underline">
                Create one →
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
