import { Gavel } from "lucide-react";

export interface VerdictDisplay {
  release_percentage: number;
  party_favored: "client" | "freelancer" | "split";
  reasoning: string;
  confidence: "high" | "medium" | "low" | "insufficient";
}

export function VerdictCard({ verdict }: { verdict: VerdictDisplay }) {
  const refund = 100 - verdict.release_percentage;
  const insufficient = verdict.confidence === "insufficient";
  return (
    <article className="rounded-lg border border-border bg-bg-elevated p-8 lg:p-12 mt-8">
      <header className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
          <Gavel className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="eyebrow">Verdict</p>
          <h2 className="mt-2 font-display text-display-lg text-fg tracking-[-0.02em] leading-[1.05]">
            {insufficient ? (
              <>
                Insufficient evidence.
                <br />
                <span className="text-fg-muted">Escalated to human review.</span>
              </>
            ) : (
              <>
                Release{" "}
                <span className="text-accent">{verdict.release_percentage}%</span> to the
                freelancer. <br />
                <span className="text-fg-muted">Refund {refund}% to the client.</span>
              </>
            )}
          </h2>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-3 gap-6 font-mono text-mono-sm">
        <div>
          <p className="text-fg-subtle uppercase tracking-[0.16em]">Party favored</p>
          <p className="mt-1 text-fg capitalize">{verdict.party_favored}</p>
        </div>
        <div>
          <p className="text-fg-subtle uppercase tracking-[0.16em]">Confidence</p>
          <p className="mt-1 text-fg capitalize">{verdict.confidence}</p>
        </div>
        <div>
          <p className="text-fg-subtle uppercase tracking-[0.16em]">Distribution</p>
          <p className="mt-1 text-fg">
            {verdict.release_percentage}% / {refund}%
          </p>
        </div>
      </div>

      <div className="hairline my-8" />

      <p className="eyebrow">Reasoning</p>
      <div className="mt-4 prose-editorial text-body text-fg max-w-[68ch] whitespace-pre-wrap leading-[1.7]">
        {verdict.reasoning}
      </div>
    </article>
  );
}
