"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { formatUsdc } from "@/lib/utils";
import type { DraftState } from "./stepper-create";
import type { MilestoneInput } from "@/lib/contract-schema";

interface Props {
  draft: DraftState;
  update: <K extends keyof DraftState>(key: K, value: DraftState[K]) => void;
  errors: Partial<Record<string, string>>;
}

export function Step2Milestones({ draft, update, errors }: Props) {
  const [suggesting, setSuggesting] = useState(false);
  const total = Number(draft.total_amount_usdc);
  const sum = useMemo(
    () => draft.milestones.reduce((a, m) => a + Number(m.amount_usdc || 0), 0),
    [draft.milestones],
  );
  const diff = total - sum;

  function setMilestone(i: number, patch: Partial<MilestoneInput>) {
    update(
      "milestones",
      draft.milestones.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    );
  }
  function add() {
    update("milestones", [
      ...draft.milestones,
      { position: draft.milestones.length, title: "", description: "", acceptance_criteria: "", amount_usdc: 0 },
    ]);
  }
  function remove(i: number) {
    if (draft.milestones.length === 1) return;
    update(
      "milestones",
      draft.milestones.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, position: idx })),
    );
  }
  function move(i: number, delta: -1 | 1) {
    const next = i + delta;
    if (next < 0 || next >= draft.milestones.length) return;
    const arr = [...draft.milestones];
    const a = arr[i]!;
    const b = arr[next]!;
    arr[i] = b;
    arr[next] = a;
    update("milestones", arr.map((m, idx) => ({ ...m, position: idx })));
  }

  async function suggest() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/contracts/suggest-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          total_amount_usdc: total,
        }),
      });
      if (!res.ok) throw new Error("suggest_failed");
      const data = (await res.json()) as { milestones: MilestoneInput[] };
      if (data.milestones?.length) {
        update(
          "milestones",
          data.milestones.map((m, idx) => ({ ...m, position: idx })),
        );
        toast.success("Suggested. Edit freely.");
      }
    } catch {
      toast.error("Suggestion service is offline. Add milestones manually.");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">Step 02</p>
          <h2 className="mt-3 font-display text-display-md text-fg tracking-tight">
            Break it into milestones.
          </h2>
        </div>
        <Button variant="ghost" onClick={suggest} loading={suggesting} leftIcon={<Sparkles className="h-4 w-4" />}>
          Suggest milestones
        </Button>
      </header>

      <ol className="space-y-4">
        {draft.milestones.map((m, i) => (
          <li
            key={i}
            className="rounded border border-border bg-bg p-5 grid grid-cols-[40px_1fr_180px] gap-4"
          >
            <div className="flex flex-col items-center gap-1 pt-1">
              <span className="font-mono text-mono-sm text-fg-subtle">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  className="h-5 w-5 inline-flex items-center justify-center text-fg-subtle hover:text-fg disabled:opacity-30"
                  disabled={i === 0}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  className="h-5 w-5 inline-flex items-center justify-center text-fg-subtle hover:text-fg disabled:opacity-30"
                  disabled={i === draft.milestones.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label="Title"
                placeholder="Discovery & wireframes"
                value={m.title}
                onChange={(e) => setMilestone(i, { title: e.target.value })}
              />
              <Textarea
                label="Description"
                placeholder="What's included; what's out of scope."
                value={m.description ?? ""}
                onChange={(e) => setMilestone(i, { description: e.target.value })}
                rows={2}
              />
              <Textarea
                label="Acceptance criteria"
                placeholder="A short list. One bullet per line."
                value={m.acceptance_criteria ?? ""}
                onChange={(e) => setMilestone(i, { acceptance_criteria: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <label className="text-caption uppercase tracking-[0.16em] text-fg-muted">Amount</label>
              <div className="flex items-baseline gap-2 rounded border border-border bg-bg-elevated px-3 py-2.5">
                <span className="font-mono text-mono-sm text-fg-subtle">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={m.amount_usdc || ""}
                  onChange={(e) => setMilestone(i, { amount_usdc: Number(e.target.value || 0) })}
                  placeholder="0.00"
                  className="flex-1 bg-transparent font-mono text-body-lg tabular-nums text-fg outline-none placeholder:text-fg-subtle min-w-0"
                />
                <span className="text-caption uppercase tracking-[0.16em] text-fg-subtle">USDC</span>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={draft.milestones.length === 1}
                className="inline-flex items-center gap-1.5 text-body-sm text-fg-subtle hover:text-danger transition-colors disabled:opacity-30 disabled:hover:text-fg-subtle"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>

      <Button variant="ghost" onClick={add} leftIcon={<Plus className="h-4 w-4" />}>
        Add milestone
      </Button>

      {/* Sticky tally */}
      <div
        className={`sticky bottom-4 mt-8 flex items-center justify-between rounded border bg-bg-elevated px-6 py-4 font-mono text-mono-sm ${
          Math.abs(diff) < 0.005 ? "border-success/40" : "border-accent/60"
        }`}
      >
        <span className="text-fg-muted uppercase tracking-[0.14em]">
          {Math.abs(diff) < 0.005 ? "Milestones match budget" : "Mismatch — adjust amounts"}
        </span>
        <span className="text-fg tabular-nums">
          ${formatUsdc(sum)} / ${formatUsdc(total)}
          {Math.abs(diff) >= 0.005 ? (
            <span className="ml-3 text-accent">
              ({diff > 0 ? "+" : ""}${formatUsdc(diff)} remaining)
            </span>
          ) : null}
        </span>
      </div>

      {errors.milestones ? (
        <p className="text-body-sm text-danger">{errors.milestones}</p>
      ) : null}
    </div>
  );
}
