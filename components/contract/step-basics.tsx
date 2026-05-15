"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AmountInput } from "@/components/ui/amount-input";
import type { DraftState } from "./stepper-create";

interface Props {
  draft: DraftState;
  update: <K extends keyof DraftState>(key: K, value: DraftState[K]) => void;
  errors: Partial<Record<string, string>>;
}

export function Step1Basics({ draft, update, errors }: Props) {
  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <p className="eyebrow">Step 01</p>
        <h2 className="mt-3 font-display text-display-md text-fg tracking-tight">
          What are you building?
        </h2>
      </header>

      <Input
        label="Contract title"
        placeholder="Marketing site redesign for Helix Software"
        value={draft.title}
        onChange={(e) => update("title", e.target.value)}
        error={errors.title}
        display
        autoFocus
      />

      <Textarea
        label="Description"
        placeholder="Briefly describe the engagement. Tone, scope, anything the client should sign onto."
        value={draft.description ?? ""}
        onChange={(e) => update("description", e.target.value)}
        rows={4}
      />

      <Input
        label="Client email"
        type="email"
        placeholder="david@helix.co"
        value={draft.client_email}
        onChange={(e) => update("client_email", e.target.value)}
        error={errors.client_email}
        hint="They'll receive a funding link. They don't need an account yet."
      />

      <AmountInput
        label="Total budget"
        value={draft.total_amount_usdc || ""}
        onChange={(e) => update("total_amount_usdc", Number(e.target.value || 0))}
        symbol="USDC"
        error={errors.total_amount_usdc}
      />
    </div>
  );
}
