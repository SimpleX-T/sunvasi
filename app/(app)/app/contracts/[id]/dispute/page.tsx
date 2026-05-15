import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { DisputeForm } from "./dispute-form";
import { supabaseAdmin, type ContractRow, type MilestoneRow } from "@/lib/supabase";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ milestone?: string }>;
}

export default async function DisputePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const db = supabaseAdmin();
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

  const targetMilestone =
    (milestones ?? []).find((m) => (m as MilestoneRow).id === sp.milestone) ??
    (milestones ?? []).find((m) => ["submitted", "in_progress"].includes((m as MilestoneRow).status)) ??
    (milestones?.[0] as MilestoneRow | undefined);

  if (!targetMilestone) notFound();
  const milestone = targetMilestone as MilestoneRow;

  return (
    <>
      <Topbar label="Open dispute" />
      <div className="flex-1 mx-auto w-full max-w-[800px] px-6 lg:px-10 py-10 lg:py-14">
        <header className="border-b border-border pb-8 mb-10">
          <p className="eyebrow">Dispute · evidence collection</p>
          <h1 className="mt-4 font-display text-display-lg text-fg tracking-[-0.02em] leading-[1.05]">
            File a dispute for milestone {String((milestone as MilestoneRow).position + 1).padStart(2, "0")}.
          </h1>
          <p className="mt-4 text-body text-fg-muted max-w-[55ch]">
            Be specific. Cite the acceptance criteria; reference what was promised, what was
            delivered, and where they differ. The arbitrator will read this verbatim.
          </p>
        </header>

        <DisputeForm
          contractShortId={contract.short_id}
          milestoneId={(milestone as MilestoneRow).id}
          milestoneTitle={(milestone as MilestoneRow).title}
          acceptanceCriteria={(milestone as MilestoneRow).acceptance_criteria ?? ""}
        />
      </div>
    </>
  );
}
