"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { ContractDraftSchema, type ContractDraft, type MilestoneInput } from "@/lib/contract-schema";
import { Stepper, type StepDef } from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { useAuthedFetch } from "@/lib/api-client";
import { Step1Basics } from "./step-basics";
import { Step2Milestones } from "./step-milestones";
import { Step3Review } from "./step-review";
import { Step4Send } from "./step-send";

const STEPS: StepDef[] = [
  { id: "basics", label: "Basics" },
  { id: "milestones", label: "Milestones" },
  { id: "review", label: "Review" },
  { id: "send", label: "Send" },
];

export type DraftState = ContractDraft;

const EMPTY_MILESTONE: MilestoneInput = {
  position: 0,
  title: "",
  description: "",
  acceptance_criteria: "",
  amount_usdc: 0,
};

interface Props {
  mode?: "create" | "edit";
  contractId?: string;
  initial?: DraftState;
  initialShortId?: string;
}

export function StepperCreate({ mode = "create", contractId, initial, initialShortId }: Props) {
  const router = useRouter();
  const authed = useAuthedFetch();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftState>(
    initial ?? {
      title: "",
      description: "",
      client_email: "",
      total_amount_usdc: 0,
      auto_release_days: 7,
      milestones: [{ ...EMPTY_MILESTONE }],
    },
  );
  const [submitting, setSubmitting] = useState(false);
  const [shortIdResult, setShortIdResult] = useState<string | null>(initialShortId ?? null);
  const [contractIdResult, setContractIdResult] = useState<string | null>(contractId ?? null);

  const update = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const errors = useMemo(() => {
    if (step === 0) return validateBasics(draft);
    if (step === 1) return validateMilestones(draft);
    return null;
  }, [draft, step]);

  const canAdvance = !errors;

  async function onSubmit() {
    setSubmitting(true);
    try {
      const parsed = ContractDraftSchema.safeParse({
        ...draft,
        milestones: draft.milestones.map((m, i) => ({ ...m, position: i })),
      });
      if (!parsed.success) {
        toast.error("Form has issues. Scroll up.");
        setSubmitting(false);
        return;
      }
      const url = mode === "edit" && contractId ? `/api/contracts/${contractId}` : "/api/contracts";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await authed(url, {
        method,
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (payload.error === "unauthenticated") {
          toast.error("Sign in to continue.");
          router.push("/sign-in?intent=create");
        } else if (payload.error === "locked") {
          toast.error(payload.message ?? "Contract is locked.");
        } else {
          toast.error(payload.message ?? "Save failed.");
        }
        return;
      }
      const data = (await res.json()) as { contract?: { id: string; short_id: string }; short_id?: string };
      if (mode === "edit") {
        toast.success("Saved.");
        router.push(`/app/contracts/${data.short_id ?? shortIdResult}`);
      } else {
        const newShort = data.contract!.short_id;
        const newId = data.contract!.id;
        setShortIdResult(newShort);
        setContractIdResult(newId);
        setStep(3);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <Stepper steps={STEPS} current={step} />

      <div className="rounded-lg border border-border bg-bg-elevated p-6 lg:p-10">
        {step === 0 ? (
          <Step1Basics draft={draft} update={update} errors={errors ?? {}} />
        ) : null}
        {step === 1 ? (
          <Step2Milestones draft={draft} update={update} errors={errors ?? {}} />
        ) : null}
        {step === 2 ? <Step3Review draft={draft} update={update} /> : null}
        {step === 3 ? (
          <Step4Send
            shortId={shortIdResult}
            contractId={contractIdResult}
            clientEmail={draft.client_email}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          disabled={step === 0 || step === 3}
        >
          Back
        </Button>
        {step < 2 ? (
          <Button
            variant="primary"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Continue
          </Button>
        ) : null}
        {step === 2 ? (
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={submitting}
            rightIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          >
            {mode === "edit" ? "Save changes" : "Create contract"}
          </Button>
        ) : null}
        {step === 3 ? <span /> : null}
      </div>
    </div>
  );
}

type Errors = Partial<Record<string, string>>;

function validateBasics(d: DraftState): Errors | null {
  const e: Errors = {};
  if (d.title.trim().length < 3) e.title = "Give the contract a title.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.client_email)) e.client_email = "Enter a valid email.";
  if (Number(d.total_amount_usdc) <= 0) e.total_amount_usdc = "Budget must be greater than zero.";
  return Object.keys(e).length ? e : null;
}

function validateMilestones(d: DraftState): Errors | null {
  if (d.milestones.length === 0) return { milestones: "Add at least one milestone." };
  for (let i = 0; i < d.milestones.length; i++) {
    const m = d.milestones[i]!;
    if (!m.title.trim()) return { milestones: `Milestone ${i + 1} needs a title.` };
    if (Number(m.amount_usdc) <= 0) return { milestones: `Milestone ${i + 1} needs an amount.` };
  }
  const sum = d.milestones.reduce((a, m) => a + Number(m.amount_usdc), 0);
  if (Math.abs(sum - Number(d.total_amount_usdc)) > 0.005) {
    return {
      milestones: `Milestones total $${sum.toFixed(2)}, contract budget is $${Number(d.total_amount_usdc).toFixed(2)}.`,
    };
  }
  return null;
}
