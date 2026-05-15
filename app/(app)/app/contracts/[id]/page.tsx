import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Copy } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { MilestoneCard, type ViewerRole } from "@/components/contract/milestone-card";
import { ActivityTimeline } from "@/components/contract/activity-timeline";
import { ContractActions } from "@/components/contract/contract-actions";
import { getCurrentUser } from "@/lib/auth";
import {
  supabaseAdmin,
  type ContractRow,
  type MilestoneRow,
  type ActivityRow,
} from "@/lib/supabase";
import { escrowViewerUrl } from "@/lib/trustless-work";
import { formatUsdc, shortenAddress } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser().catch(() => null);
  const db = supabaseAdmin();

  // Accept either UUID or short_id in the URL.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
  const { data: contract } = isUuid
    ? await db.from("contracts").select("*").eq("id", id).maybeSingle<ContractRow>()
    : await db.from("contracts").select("*").eq("short_id", id).maybeSingle<ContractRow>();
  if (!contract) notFound();

  const { data: milestones } = await db
    .from("milestones")
    .select("*")
    .eq("contract_id", contract.id)
    .order("position", { ascending: true });
  const { data: activity } = await db
    .from("activity")
    .select("*")
    .eq("contract_id", contract.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const role: ViewerRole =
    user?.did === contract.client_id
      ? "client"
      : user?.did === contract.freelancer_id
        ? "freelancer"
        : "viewer";

  const network = contract.escrow_network === "mainnet" ? "mainnet" : "testnet";
  const viewerHref = escrowViewerUrl(contract.escrow_id, network);

  return (
    <>
      <Topbar label="Contract" />
      <div className="flex-1 mx-auto w-full max-w-[1200px] px-6 lg:px-10 py-10 lg:py-12 space-y-12">
        <header className="grid lg:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <StatusBadge status={contract.status} />
              <span className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.14em]">
                ID · {contract.short_id}
              </span>
              {contract.escrow_id ? (
                <span className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.14em]">
                  Escrow · {shortenAddress(contract.escrow_id)}
                </span>
              ) : null}
            </div>
            <h1 className="font-display text-display-lg text-fg tracking-[-0.02em] leading-[1.05]">
              {contract.title}
            </h1>
            {contract.description ? (
              <p className="mt-4 text-body text-fg-muted max-w-[60ch] leading-[1.55]">
                {contract.description}
              </p>
            ) : null}
            <div className="mt-6 flex items-center gap-4 text-body-sm">
              <Avatar
                name={contract.client_email ?? "Client"}
                size={28}
                className="bg-warning/15 text-warning"
              />
              <span className="text-fg-muted">
                Client · <span className="text-fg">{contract.client_email ?? "Pending"}</span>
              </span>
            </div>

            {role === "freelancer" ? (
              <div className="mt-6 border-t border-border pt-5">
                <ContractActions
                  contractId={contract.id}
                  shortId={contract.short_id}
                  status={contract.status}
                  clientEmail={contract.client_email}
                  visibility={contract.visibility}
                  inviteeEmails={contract.invitee_emails ?? []}
                />
              </div>
            ) : null}
          </div>

          <aside className="rounded-lg border border-border bg-bg-elevated p-5 space-y-3 min-w-[280px]">
            <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Total</p>
            <p className="font-mono text-display-sm text-fg tabular-nums">
              ${formatUsdc(contract.total_amount_usdc)} <span className="text-fg-subtle text-body-sm">USDC</span>
            </p>
            <div className="hairline" />
            <p className="text-body-sm text-fg-muted">
              Auto-release window:{" "}
              <span className="text-fg font-mono">{contract.auto_release_days} days</span>
            </p>
            {viewerHref ? (
              <a
                href={viewerHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-body-sm text-accent hover:underline"
              >
                View on Trustless Work
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <Link
              href={`/c/${contract.short_id}`}
              className="inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-fg transition-colors"
            >
              <Copy className="h-3.5 w-3.5" /> Public funding page
            </Link>
          </aside>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-10">
          <section className="space-y-4">
            <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Milestones</h2>
            {(milestones ?? []).map((m, i) => (
              <MilestoneCard
                key={m.id}
                milestone={m as MilestoneRow}
                position={i}
                role={role}
                contractStatus={contract.status}
              />
            ))}
          </section>

          <aside className="space-y-4">
            <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Activity</h2>
            <div className="rounded-lg border border-border bg-bg-elevated p-5">
              <ActivityTimeline events={(activity ?? []) as ActivityRow[]} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
