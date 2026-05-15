import Link from "next/link";
import { ArrowRight, Mail, Sparkles, Wallet } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import {
  supabaseAdmin,
  type ActivityRow,
  type ContractRow,
  type MilestoneRow,
} from "@/lib/supabase";
import { formatUsdc, relativeTime, timeOfDayGreeting } from "@/lib/utils";

export default async function DashboardPage() {
  const [profile, user] = await Promise.all([
    getCurrentProfile().catch(() => null),
    getCurrentUser().catch(() => null),
  ]);
  const greeting = timeOfDayGreeting();
  const firstName = profile?.display_name?.split(" ")[0] ?? "there";

  const role = profile?.role ?? "freelancer";
  const isClient = role === "client";
  const isFreelancer = role === "freelancer" || role === "both";

  let contracts: ContractRow[] = [];
  let activeCount = 0;
  let pendingMilestones: Array<{ contract: ContractRow; milestone: MilestoneRow }> = [];
  let recentActivity: Array<{ row: ActivityRow; contractTitle: string }> = [];

  if (user) {
    try {
      const db = supabaseAdmin();
      // Match by:
      //   - freelancer_id (owner)
      //   - client_id (bound after first fund)
      //   - client_email (pre-invited by name)
      //   - invitee_emails ⊃ {viewer email} (view-only collaborators)
      // Everyone involved sees the contract on their dashboard; only client +
      // freelancer can actually act on it (UI gates actions further down).
      const email = profile?.email?.toLowerCase();
      const orFilter = email
        ? `freelancer_id.eq.${user.did},client_id.eq.${user.did},client_email.eq.${email},invitee_emails.cs.{${email}}`
        : `freelancer_id.eq.${user.did},client_id.eq.${user.did}`;
      const { data } = await db
        .from("contracts")
        .select("*")
        .or(orFilter)
        .order("created_at", { ascending: false });
      contracts = (data ?? []) as ContractRow[];
      activeCount = contracts.filter((c) => c.status === "active" || c.status === "disputed").length;

      const ids = contracts.map((c) => c.id);
      if (ids.length > 0) {
        const { data: ms } = await db
          .from("milestones")
          .select("*")
          .in("contract_id", ids)
          .in("status", isFreelancer ? ["in_progress", "submitted"] : ["submitted"])
          .order("position", { ascending: true });
        pendingMilestones = ((ms ?? []) as MilestoneRow[]).map((m) => ({
          milestone: m,
          contract: contracts.find((c) => c.id === m.contract_id)!,
        }));
        const { data: act } = await db
          .from("activity")
          .select("*")
          .in("contract_id", ids)
          .order("created_at", { ascending: false })
          .limit(8);
        recentActivity = ((act ?? []) as ActivityRow[]).map((r) => ({
          row: r,
          contractTitle: contracts.find((c) => c.id === r.contract_id)?.title ?? "Contract",
        }));
      }
    } catch {
      contracts = [];
    }
  }

  const empty = contracts.length === 0;

  return (
    <>
      <Topbar label="Dashboard" />
      <div className="flex-1 mx-auto w-full max-w-[1200px] px-6 lg:px-10 py-10 lg:py-14 space-y-12">
        <header>
          <h1 className="font-display text-display-md text-fg tracking-[-0.015em]">
            Good {greeting}, {firstName}.
          </h1>
          <p className="mt-2 text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
            {activeCount} active contract{activeCount === 1 ? "" : "s"} · {pendingMilestones.length} pending milestone
            {pendingMilestones.length === 1 ? "" : "s"} ·{" "}
            <span className="text-accent">{roleLabel(role)}</span>
          </p>
        </header>

        {/* Primary CTA — role-aware */}
        {isFreelancer ? (
          <Link
            href="/app/contracts/new"
            className="group flex items-center gap-6 rounded-lg border border-border bg-bg-elevated p-6 lg:p-8 hover:border-accent transition-colors duration-150 ease-sunvasi"
          >
            <div className="h-12 w-12 rounded border border-accent/30 bg-accent/10 flex items-center justify-center text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-display-sm text-fg tracking-tight">
                Create a new contract
              </p>
              <p className="mt-1 text-body-sm text-fg-muted">
                Milestones, acceptance criteria, USDC budget. Send it to your client in a single link.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-fg-muted group-hover:text-accent transition-colors" />
          </Link>
        ) : null}

        {isClient ? (
          <div className="rounded-lg border border-border bg-bg-elevated p-6 lg:p-8 flex items-start gap-5">
            <div className="h-12 w-12 rounded border border-accent/30 bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-display-sm text-fg tracking-tight">
                Waiting for a contract.
              </p>
              <p className="mt-1 text-body-sm text-fg-muted max-w-[60ch]">
                Sunvasi&apos;s flow starts with a freelancer composing the contract. They&apos;ll share a
                link like <span className="font-mono">sunvasi.com/c/XXXXXXXX</span>. Open it, review,
                fund — and we take it from there.
              </p>
              <Link
                href="/app/contracts/DEMOH3LX/arbitration"
                className="mt-4 inline-flex items-center gap-1.5 text-body-sm text-accent hover:underline"
              >
                See how it works on the demo →
              </Link>
            </div>
          </div>
        ) : null}

        {/* Pending milestones — only when there are some */}
        {pendingMilestones.length > 0 ? (
          <section>
            <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-4">
              Needs attention
            </h2>
            <ul className="rounded-lg border border-border divide-y divide-border bg-bg-elevated">
              {pendingMilestones.slice(0, 5).map(({ milestone, contract }) => (
                <li key={milestone.id}>
                  <Link
                    href={`/app/contracts/${contract.short_id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-bg-subtle transition-colors"
                  >
                    <span className="font-mono text-mono-sm text-fg-subtle w-8">
                      {String(milestone.position + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-body text-fg truncate">{milestone.title}</p>
                      <p className="text-body-sm text-fg-muted truncate">{contract.title}</p>
                    </div>
                    <span className="font-mono text-mono-sm tabular-nums text-fg">
                      ${formatUsdc(milestone.amount_usdc)}
                    </span>
                    <StatusBadge status={milestone.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid lg:grid-cols-[1fr_320px] gap-10">
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle">
                Active contracts
              </h2>
              <Link
                href="/app/contracts"
                className="text-body-sm text-fg-muted hover:text-fg transition-colors"
              >
                View all →
              </Link>
            </div>

            {empty ? (
              <div className="rounded-lg border border-border bg-bg-elevated p-10 lg:p-14 text-center">
                <p className="font-display text-display-md text-fg-muted tracking-tight">
                  No contracts yet.
                </p>
                <p className="mt-3 text-body-sm text-fg-subtle max-w-[44ch] mx-auto">
                  {isFreelancer
                    ? "Create your first to bring a client into a trustless agreement."
                    : "Once a freelancer shares a funding link with you, it'll appear here."}
                </p>
                {isFreelancer ? (
                  <Link
                    href="/app/contracts/new"
                    className="mt-6 inline-flex items-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-4 py-2 text-body-sm transition-colors"
                  >
                    Create contract <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="rounded-lg border border-border divide-y divide-border bg-bg-elevated">
                {contracts.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app/contracts/${c.short_id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-bg-subtle transition-colors"
                    >
                      <Avatar
                        name={c.client_email ?? "Client"}
                        size={32}
                        className="bg-warning/15 text-warning shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-body text-fg tracking-tight truncate">
                          {c.title}
                        </p>
                        <p className="text-body-sm text-fg-muted truncate">
                          {c.client_email ?? "Client pending"} · {relativeTime(c.created_at)}
                        </p>
                      </div>
                      <span className="font-mono text-mono-sm tabular-nums text-fg shrink-0">
                        ${formatUsdc(c.total_amount_usdc)}
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside>
            <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-4">
              Recent activity
            </h2>
            <div className="rounded-lg border border-border bg-bg-elevated p-5">
              {recentActivity.length === 0 ? (
                <p className="text-body-sm text-fg-subtle italic">
                  Activity will appear here once contracts move.
                </p>
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map(({ row, contractTitle }) => (
                    <li key={row.id} className="text-body-sm">
                      <p className="text-fg">
                        {activityVerb(row.type)} <span className="text-fg-muted">·</span>{" "}
                        <span className="text-fg-muted truncate inline-block max-w-[150px] align-bottom">
                          {contractTitle}
                        </span>
                      </p>
                      <p className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.12em]">
                        {relativeTime(row.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isFreelancer ? (
              <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-5">
                <div className="flex items-start gap-2.5">
                  <Wallet className="h-4 w-4 mt-0.5 text-fg-muted" />
                  <div>
                    <p className="text-body-sm text-fg">Payout in USDC</p>
                    <p className="mt-1 text-body-sm text-fg-subtle">
                      Off-ramp to Naira via{" "}
                      <a className="underline hover:text-fg" href="https://yellowcard.io" target="_blank" rel="noopener noreferrer">
                        Yellow Card
                      </a>
                      , Onboard, or Busha.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </>
  );
}

function roleLabel(role: string): string {
  if (role === "freelancer") return "Freelancing";
  if (role === "client") return "Hiring";
  return "Freelancing & hiring";
}

function activityVerb(type: string): string {
  switch (type) {
    case "created":
      return "Contract created";
    case "funded":
      return "Funded";
    case "submitted":
      return "Milestone submitted";
    case "approved":
      return "Milestone approved";
    case "released":
      return "Funds released";
    case "disputed":
      return "Dispute opened";
    case "verdict":
      return "Verdict reached";
    default:
      return type;
  }
}
