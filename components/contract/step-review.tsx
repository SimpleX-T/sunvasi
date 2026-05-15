"use client";

import { formatUsdc } from "@/lib/utils";
import type { DraftState } from "./stepper-create";

interface Props {
  draft: DraftState;
  update: <K extends keyof DraftState>(key: K, value: DraftState[K]) => void;
}

export function Step3Review({ draft, update }: Props) {
  return (
    <div className="space-y-10 max-w-3xl">
      <header>
        <p className="eyebrow">Step 03 — Review</p>
        <h2 className="mt-3 font-display text-display-md text-fg tracking-tight">
          What your client will see.
        </h2>
        <p className="mt-2 text-body-sm text-fg-muted">
          A typeset preview of the contract. Edit by going back; finalize below.
        </p>
      </header>

      <article className="rounded-lg border border-border bg-bg p-8 lg:p-12">
        <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
          Sunvasi · Escrow agreement
        </p>
        <h3 className="mt-3 font-display text-display-xl text-fg leading-[1.0] tracking-[-0.025em]">
          {draft.title || "Untitled contract"}
        </h3>
        {draft.description ? (
          <p className="mt-6 text-body-lg text-fg-muted max-w-[60ch] leading-[1.55]">
            {draft.description}
          </p>
        ) : null}

        <div className="mt-10 grid grid-cols-2 gap-6 text-body-sm">
          <div>
            <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
              Total
            </p>
            <p className="mt-1 font-mono text-mono-lg text-fg tabular-nums">
              ${formatUsdc(draft.total_amount_usdc)} USDC
            </p>
          </div>
          <div>
            <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
              Client
            </p>
            <p className="mt-1 text-fg">{draft.client_email || "—"}</p>
          </div>
        </div>

        <div className="hairline my-10" />

        <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
          Milestones
        </p>
        <ol className="mt-6 space-y-6">
          {draft.milestones.map((m, i) => (
            <li key={i} className="grid grid-cols-[40px_1fr_140px] gap-4 items-baseline">
              <span className="font-display text-display-sm text-fg-subtle font-light">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h4 className="font-display text-display-sm text-fg tracking-tight">
                  {m.title || "Untitled"}
                </h4>
                {m.description ? (
                  <p className="mt-1 text-body-sm text-fg-muted leading-[1.55]">{m.description}</p>
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

        <div className="hairline my-10" />
        <p className="text-body-sm text-fg-muted leading-[1.55] max-w-[60ch]">
          Funds are held in a non-custodial escrow on Stellar via Trustless Work. Each
          milestone releases on the client&apos;s approval or automatically after the
          auto-release window. Disputes are resolved by the Sunvasi Arbitrator under the
          rules at <span className="underline">/arbitration</span>.
        </p>
      </article>

      <div>
        <p className="eyebrow">Auto-release window</p>
        <p className="mt-3 text-body-sm text-fg-muted max-w-[52ch]">
          If the client doesn&apos;t approve a submitted milestone within this window,
          funds release automatically.
        </p>
        <div className="mt-5 flex items-center gap-4">
          <input
            type="range"
            min={3}
            max={14}
            step={1}
            value={draft.auto_release_days}
            onChange={(e) => update("auto_release_days", Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="font-mono text-mono-lg text-fg tabular-nums w-20 text-right">
            {draft.auto_release_days} days
          </span>
        </div>
      </div>
    </div>
  );
}
