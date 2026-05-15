import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ArbitrationLiveView } from "@/components/arbitration/live-view";
import { supabaseAdmin, type ContractRow, type DisputeRow, type MilestoneRow } from "@/lib/supabase";
import { ARBITRATOR_VERSION } from "@/lib/arbitrator/system-prompt";
import { formatUsdc } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ArbitrationPage({ params }: Props) {
  const { id } = await params;
  const db = supabaseAdmin();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id);
  const { data: contract } = isUuid
    ? await db.from("contracts").select("*").eq("id", id).maybeSingle<ContractRow>()
    : await db.from("contracts").select("*").eq("short_id", id).maybeSingle<ContractRow>();
  if (!contract) notFound();

  const { data: dispute } = await db
    .from("disputes")
    .select("*")
    .eq("contract_id", contract.id)
    .order("filed_at", { ascending: false })
    .limit(1)
    .maybeSingle<DisputeRow>();
  if (!dispute) notFound();
  const { data: milestone } = await db
    .from("milestones")
    .select("*")
    .eq("id", dispute.milestone_id)
    .maybeSingle<MilestoneRow>();

  return (
    <>
      <Topbar label="Arbitration">
        <Link
          href={`/app/contracts/${contract.short_id}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> back to contract
        </Link>
      </Topbar>

      <div className="flex-1 mx-auto w-full max-w-[1200px] px-6 lg:px-10 py-10 lg:py-12 space-y-10">
        <header className="rounded-lg border border-border bg-bg-elevated p-6 lg:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <Scale className="h-4 w-4" />
            </span>
            <StatusBadge status={dispute.status} />
            <span className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.14em]">
              v · {ARBITRATOR_VERSION}
            </span>
          </div>
          <h1 className="mt-5 font-display text-display-lg text-fg tracking-[-0.02em] leading-[1.05]">
            {contract.title}
          </h1>
          <p className="mt-2 text-body-sm text-fg-muted">
            Milestone in dispute · <span className="text-fg">{milestone?.title ?? "—"}</span>{" "}
            · <span className="font-mono">${formatUsdc(Number(milestone?.amount_usdc ?? 0))} USDC</span>
          </p>

          <div className="mt-6 flex items-center gap-6 text-body-sm">
            <div className="flex items-center gap-2.5">
              <Avatar name={contract.client_email ?? "Client"} size={28} />
              <span className="text-fg-muted">
                Client · <span className="text-fg">{contract.client_email ?? "Pending"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar name="Freelancer" size={28} className="bg-accent/15 text-accent" />
              <span className="text-fg-muted">Freelancer</span>
            </div>
          </div>
        </header>

        <ArbitrationLiveView disputeId={dispute.id} />
      </div>
    </>
  );
}
