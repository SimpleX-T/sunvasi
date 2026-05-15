import { notFound, redirect } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { StepperCreate, type DraftState } from "@/components/contract/stepper-create";
import { getCurrentUser } from "@/lib/auth";
import { supabaseAdmin, type ContractRow, type MilestoneRow } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser().catch(() => null);
  const db = supabaseAdmin();
  const isUuid = UUID_RE.test(id);
  const { data: contract } = isUuid
    ? await db.from("contracts").select("*").eq("id", id).maybeSingle<ContractRow>()
    : await db.from("contracts").select("*").eq("short_id", id).maybeSingle<ContractRow>();
  if (!contract) notFound();
  if (user && contract.freelancer_id !== user.did) redirect(`/app/contracts/${contract.short_id}`);
  if (contract.status !== "awaiting_funding" && contract.status !== "draft") {
    redirect(`/app/contracts/${contract.short_id}`);
  }

  const { data: ms } = await db
    .from("milestones")
    .select("*")
    .eq("contract_id", contract.id)
    .order("position", { ascending: true });

  const initial: DraftState = {
    title: contract.title,
    description: contract.description ?? "",
    client_email: contract.client_email ?? "",
    total_amount_usdc: Number(contract.total_amount_usdc),
    auto_release_days: contract.auto_release_days,
    milestones: ((ms ?? []) as MilestoneRow[]).map((m, i) => ({
      position: i,
      title: m.title,
      description: m.description ?? "",
      acceptance_criteria: m.acceptance_criteria ?? "",
      amount_usdc: Number(m.amount_usdc),
    })),
  };

  return (
    <>
      <Topbar label="Edit contract" />
      <div className="flex-1 mx-auto w-full max-w-[1100px] px-6 lg:px-10 py-10 lg:py-14">
        <header className="mb-10">
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">
            Edit {contract.title}.
          </h1>
          <p className="mt-3 text-body text-fg-muted max-w-[55ch]">
            Drafts can be edited freely. Once your client funds the escrow this view becomes
            read-only.
          </p>
        </header>
        <StepperCreate
          mode="edit"
          contractId={contract.id}
          initialShortId={contract.short_id}
          initial={initial}
        />
      </div>
    </>
  );
}
