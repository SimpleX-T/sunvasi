import Link from "next/link";
import { ArrowRight, ChevronRight, Plus } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { supabaseAdmin, type ContractRow } from "@/lib/supabase";
import { formatUsdc, relativeTime } from "@/lib/utils";

export default async function ContractsListPage() {
  const [user, profile] = await Promise.all([
    getCurrentUser().catch(() => null),
    getCurrentProfile().catch(() => null),
  ]);
  let contracts: ContractRow[] = [];
  if (user) {
    try {
      const db = supabaseAdmin();
      // Same matching strategy as the dashboard — include client_email so
      // pre-invited clients see their contract before they fund it.
      const email = profile?.email?.toLowerCase();
      const orFilter = email
        ? `freelancer_id.eq.${user.did},client_id.eq.${user.did},client_email.eq.${email}`
        : `freelancer_id.eq.${user.did},client_id.eq.${user.did}`;
      const { data } = await db
        .from("contracts")
        .select("*")
        .or(orFilter)
        .order("created_at", { ascending: false });
      contracts = (data ?? []) as ContractRow[];
    } catch {
      contracts = [];
    }
  }

  return (
    <>
      <Topbar label="Contracts">
        <Link
          href="/app/contracts/new"
          className="inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:bg-accent-hover rounded px-3 py-1.5 text-body-sm transition-colors duration-150 ease-sunvasi"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
      </Topbar>

      <div className="flex-1 mx-auto w-full max-w-[1100px] px-6 lg:px-10 py-10 lg:py-12">
        <header className="mb-10">
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">All contracts</h1>
          <p className="mt-2 text-body-sm text-fg-muted">
            {contracts.length} contract{contracts.length === 1 ? "" : "s"}
          </p>
        </header>

        {contracts.length === 0 ? (
          <div className="rounded-lg border border-border bg-bg-elevated p-12 text-center">
            <p className="font-display text-display-md text-fg-muted tracking-tight">
              No contracts yet.
            </p>
            <Link
              href="/app/contracts/new"
              className="mt-6 inline-flex items-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-4 py-2 text-body-sm transition-colors"
            >
              Create your first <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {contracts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/contracts/${c.short_id}`}
                  className="flex items-center gap-5 px-5 lg:px-6 py-5 hover:bg-bg-subtle transition-colors"
                >
                  <Avatar
                    name={c.client_email ?? "Client"}
                    size={36}
                    className="bg-warning/15 text-warning"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-display-sm text-fg tracking-tight truncate">
                      {c.title}
                    </p>
                    <p className="mt-1 text-body-sm text-fg-muted truncate">
                      {c.client_email ?? "Client pending"} ·{" "}
                      <span className="font-mono text-mono-sm">
                        ${formatUsdc(c.total_amount_usdc)}
                      </span>{" "}
                      · {relativeTime(c.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                  <ChevronRight className="h-4 w-4 text-fg-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
