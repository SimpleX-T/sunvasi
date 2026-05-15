"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  contractShortId: string;
  milestoneId: string;
  milestoneTitle: string;
  acceptanceCriteria: string;
}

export function DisputeForm({ contractShortId, milestoneId, milestoneTitle, acceptanceCriteria }: Props) {
  const router = useRouter();
  const [promised, setPromised] = useState(acceptanceCriteria);
  const [delivered, setDelivered] = useState("");
  const [gap, setGap] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (promised.trim().length < 10 || delivered.trim().length < 5 || gap.trim().length < 5) {
      toast.error("Please fill all three fields with at least a sentence each.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/milestones/${milestoneId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promised, delivered, gap, files: [] }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Dispute filed. The arbitrator is reviewing.");
      router.push(`/app/contracts/${contractShortId}/arbitration`);
    } catch {
      toast.error("Could not file dispute.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.14em]">
        Milestone · {milestoneTitle}
      </p>

      <Textarea
        label="What was promised?"
        value={promised}
        onChange={(e) => setPromised(e.target.value)}
        hint="Pre-filled with the milestone's acceptance criteria. Edit if needed."
        rows={5}
      />
      <Textarea
        label="What was delivered?"
        value={delivered}
        onChange={(e) => setDelivered(e.target.value)}
        placeholder="Describe the actual deliverable. Reference filenames or links."
        rows={5}
      />
      <Textarea
        label="What's the specific gap?"
        value={gap}
        onChange={(e) => setGap(e.target.value)}
        placeholder="Where the delivery falls short of the acceptance criteria — concretely."
        rows={4}
      />

      <div className="hairline mt-4" />

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={submitting}
          leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        >
          File dispute
        </Button>
      </div>
    </div>
  );
}
