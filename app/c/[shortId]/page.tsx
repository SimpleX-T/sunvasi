import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/marketing/wordmark";
import { FundAction } from "@/components/contract/fund-action";
import { supabaseAdmin, type ContractRow, type MilestoneRow } from "@/lib/supabase";
import { formatUsdc } from "@/lib/utils";

interface Props {
  params: Promise<{ shortId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shortId } = await params;
  return {
    title: `Contract ${shortId} · Sunvasi`,
    description: "A contract held in escrow on Sunvasi. Fund to begin.",
  };
}

export default async function PublicContractPage({ params }: Props) {
  const { shortId } = await params;
  let contract: ContractRow | null = null;
  let milestones: MilestoneRow[] = [];
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("contracts")
      .select("*")
      .eq("short_id", shortId)
      .maybeSingle<ContractRow>();
    contract = data;
    if (contract) {
      const { data: ms } = await db
        .from("milestones")
        .select("*")
        .eq("contract_id", contract.id)
        .order("position", { ascending: true });
      milestones = (ms ?? []) as MilestoneRow[];
    }
  } catch {
    contract = null;
  }
  if (!contract) notFound();

  const isFunded = contract.status !== "awaiting_funding" && contract.status !== "draft";

  return (
    <div className="min-h-svh">
      {/* top bar */}
      <header className="border-b border-border bg-bg/70 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-[1100px] flex items-center justify-between px-6 py-4 lg:px-10">
          <Wordmark size="sm" />
          <div className="flex items-center gap-2">
            {contract.visibility === "restricted" ? (
              <span className="inline-flex items-center gap-1.5 rounded border border-warning/40 bg-warning/5 text-warning px-2.5 py-1 text-caption uppercase tracking-[0.14em]">
                <Lock className="h-3.5 w-3.5" />
                Invitation-only
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded border border-success/40 bg-success/5 text-success px-2.5 py-1 text-caption uppercase tracking-[0.14em]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Held in escrow
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 lg:px-10 pt-12 pb-40">
        <article>
          <p className="eyebrow">Escrow agreement</p>
          <h1 className="mt-6 font-display text-display-2xl text-fg leading-[0.96] tracking-[-0.025em]">
            {contract.title}
          </h1>
          <p className="mt-6 text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
            Between{" "}
            <span className="text-fg-muted">
              {contract.client_email ?? "you"}
            </span>{" "}
            ·{" "}
            <span className="text-fg-muted">a freelancer</span>{" "}
            · drafted {new Date(contract.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>

          {contract.description ? (
            <p className="mt-10 text-body-lg text-fg-muted max-w-[62ch] leading-[1.6]">
              {contract.description}
            </p>
          ) : null}

          <div className="hairline my-12" />

          <section>
            <p className="eyebrow">Milestones</p>
            <ol className="mt-8 space-y-8">
              {milestones.map((m, i) => (
                <li key={m.id} className="grid grid-cols-[40px_1fr_140px] gap-4 items-baseline">
                  <span className="font-display text-display-md text-fg-subtle font-light">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-display-sm text-fg tracking-tight">{m.title}</h3>
                    {m.description ? (
                      <p className="mt-2 text-body text-fg-muted leading-[1.55]">{m.description}</p>
                    ) : null}
                    {m.acceptance_criteria ? (
                      <ul className="mt-3 list-none text-body-sm text-fg-muted space-y-1">
                        {m.acceptance_criteria
                          .split("\n")
                          .filter(Boolean)
                          .map((line, ln) => (
                            <li key={ln} className="pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-fg-subtle">
                              {line}
                            </li>
                          ))}
                      </ul>
                    ) : null}
                  </div>
                  <p className="text-right font-mono text-mono-lg text-fg tabular-nums">
                    ${formatUsdc(m.amount_usdc)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <div className="hairline my-12" />

          <p className="text-body-sm text-fg-muted leading-[1.65] max-w-[62ch]">
            Funds are held by a non-custodial smart contract on Stellar via Trustless Work.
            Each milestone releases on your approval, or automatically after the agreed
            window of {contract.auto_release_days} days. Disputes are resolved by the
            Sunvasi Arbitrator under the public rules at{" "}
            <Link href="/arbitration" className="underline hover:text-fg">
              /arbitration
            </Link>
            .
          </p>
        </article>

        {isFunded ? (
          <div className="mt-10 rounded-lg border border-success/30 bg-success/5 px-6 py-4 text-body-sm text-success font-mono">
            ✓ Funded · escrow {contract.escrow_id ?? "(synthesised)"}
          </div>
        ) : null}
      </main>

      {!isFunded ? (
        <FundAction
          contractId={contract.id}
          shortId={contract.short_id}
          total={Number(contract.total_amount_usdc)}
          clientEmail={contract.client_email}
          freelancerId={contract.freelancer_id}
          visibility={contract.visibility}
          layout="sticky-bottom"
        />
      ) : null}
    </div>
  );
}
