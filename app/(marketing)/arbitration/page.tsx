import type { Metadata } from "next";
import { ARBITRATOR_VERSION, SUNVASI_ARBITRATOR_SYSTEM_PROMPT } from "@/lib/arbitrator/system-prompt";
import { PUBLIC_TOOL_INDEX } from "@/lib/arbitrator/tools";

export const metadata: Metadata = {
  title: "Arbitration",
  description:
    "The Sunvasi Arbitrator's full system prompt and tool definitions. Trustlessness includes the rules.",
};

export default function ArbitrationPage() {
  return (
    <article className="mx-auto max-w-[1280px] px-6 lg:px-10 pt-16 lg:pt-24 pb-24">
      <header className="border-b border-border pb-12">
        <p className="eyebrow">The constitution</p>
        <h1 className="mt-6 font-display text-display-2xl text-fg tracking-[-0.025em] leading-[0.96]">
          The arbitrator&apos;s rules,
          <br />
          <span className="text-fg-muted">in plain text.</span>
        </h1>
        <p className="mt-6 max-w-[62ch] text-body-lg text-fg-muted leading-[1.55]">
          The Sunvasi Arbitrator is an AI judge. Below is the exact system prompt it operates
          under, and the exact set of tools it can use. Both are public. Every verdict
          records the version of this prompt so historical decisions remain reproducible.
        </p>
        <p className="mt-4 font-mono text-mono-sm text-fg-subtle">
          version · {ARBITRATOR_VERSION}
        </p>
      </header>

      <section className="mt-16 grid lg:grid-cols-[1fr_0.7fr] gap-12 lg:gap-20">
        <div>
          <h2 className="font-display text-display-md text-fg tracking-tight">
            Why publish the prompt?
          </h2>
          <div className="mt-4 prose-editorial">
            <p>
              The funds are held by a non-custodial smart contract. The verdicts are also
              non-custodial in a different sense: they are produced by a process you can
              audit. If you don&apos;t trust the rules, you can read them. If they change,
              the version hash will change with them.
            </p>
            <p>
              Partial verdicts (release 75%, refund 25%) are the norm, not the exception.
              Real disputes are rarely 100/0.
            </p>
            <p>
              When the arbitrator&apos;s confidence is &ldquo;insufficient,&rdquo; no funds
              move. The dispute escalates to a human reviewer. Sunvasi never silently
              decides for you.
            </p>
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-bg-elevated p-6">
          <p className="eyebrow">Tools the arbitrator can call</p>
          <ul className="mt-6 space-y-4">
            {PUBLIC_TOOL_INDEX.map((t) => (
              <li key={t.name}>
                <p className="font-mono text-mono-sm text-accent">{t.name}</p>
                <p className="mt-1 text-body-sm text-fg-muted leading-[1.55]">{t.description}</p>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section className="mt-20 border-t border-border pt-12">
        <p className="eyebrow">The system prompt</p>
        <h2 className="mt-6 font-display text-display-lg text-fg tracking-[-0.02em] leading-[1.05]">
          Verbatim.
        </h2>
        <pre className="mt-10 whitespace-pre-wrap rounded-lg border border-border bg-bg-elevated p-6 lg:p-10 font-mono text-mono-sm text-fg leading-[1.7] overflow-x-auto">
          {SUNVASI_ARBITRATOR_SYSTEM_PROMPT}
        </pre>
      </section>
    </article>
  );
}
