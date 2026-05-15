"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, FileText, Link2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitDeliverableDialog } from "@/components/contract/submit-deliverable-dialog";
import { formatUsdc, relativeTime } from "@/lib/utils";
import type { MilestoneRow, DeliverableFile, DeliverableLink } from "@/lib/supabase";

export type ViewerRole = "client" | "freelancer" | "viewer";

export function MilestoneCard({
  milestone,
  role,
  contractStatus,
  position,
}: {
  milestone: MilestoneRow;
  role: ViewerRole;
  contractStatus: string;
  position: number;
}) {
  const [expanded, setExpanded] = useState(milestone.status !== "released" && milestone.status !== "approved");
  const [submitting, setSubmitting] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const router = useRouter();

  const files = (milestone.deliverable_files ?? []) as DeliverableFile[];
  const links = (milestone.deliverable_links ?? []) as DeliverableLink[];

  const canSubmit = role === "freelancer" && milestone.status === "in_progress";
  const canReview = role === "client" && milestone.status === "submitted";

  async function approve() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/milestones/${milestone.id}/approve`, { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
        stage?: string;
      };
      if (!res.ok) {
        const stage = payload.stage;
        const fallback =
          stage === "fund"
            ? "Couldn't move USDC into escrow. Top up the client wallet from the Circle faucet."
            : stage === "approve"
              ? "TW rejected the approval. Check the contract state on the Trustless Work viewer."
              : stage === "release"
                ? "USDC moved into escrow but didn't release to the freelancer — retry to push it through."
                : "Could not approve.";
        toast.error(payload.message ?? fallback);
        return;
      }
      toast.success(`Paid $${Number(milestone.amount_usdc).toFixed(2)} and released to freelancer.`);
      router.refresh();
    } catch {
      toast.error("Could not approve.");
    } finally {
      setSubmitting(false);
    }
  }

  const countdown =
    milestone.status === "submitted" && milestone.auto_release_at
      ? `Auto-releases ${relativeTime(milestone.auto_release_at)}`
      : null;

  return (
    <article className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-6 py-5 flex items-center gap-5 hover:bg-bg-subtle transition-colors"
      >
        <span className="font-display text-display-sm text-fg-subtle font-light w-10 shrink-0">
          {String(position + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-display-sm text-fg tracking-tight truncate">
            {milestone.title}
          </h3>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-body-sm text-fg-muted">
            <StatusBadge status={milestone.status} />
            <span className="font-mono text-mono-sm tabular-nums">
              ${formatUsdc(milestone.amount_usdc)}
            </span>
            {countdown ? <span className="text-warning font-mono text-mono-sm">{countdown}</span> : null}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-fg-subtle transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="border-t border-border px-6 py-5 space-y-5">
          {milestone.description ? (
            <p className="text-body text-fg-muted leading-[1.55]">{milestone.description}</p>
          ) : null}
          {milestone.acceptance_criteria ? (
            <div>
              <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-2">
                Acceptance criteria
              </p>
              <ul className="list-none text-body-sm text-fg space-y-1">
                {milestone.acceptance_criteria
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <li
                      key={i}
                      className="pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-fg-subtle"
                    >
                      {line}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {(files.length > 0 || links.length > 0 || milestone.deliverable_note) ? (
            <div>
              <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-2">Deliverables</p>
              {milestone.deliverable_note ? (
                <p className="text-body-sm text-fg-muted mb-3 italic">&ldquo;{milestone.deliverable_note}&rdquo;</p>
              ) : null}
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li key={i}>
                    <a
                      href={f.cloudinary_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-body-sm text-fg hover:text-accent transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-fg-subtle" />
                      {f.filename}
                      <span className="font-mono text-mono-sm text-fg-subtle">
                        {(f.size / 1024).toFixed(0)}KB
                      </span>
                    </a>
                  </li>
                ))}
                {links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-body-sm text-fg hover:text-accent transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5 text-fg-subtle" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canSubmit ? (
            <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSubmitOpen(true)}
                disabled={submitting}
                leftIcon={<Upload className="h-4 w-4" />}
              >
                Submit deliverable
              </Button>
              <span className="text-body-sm text-fg-subtle">
                The client has {milestone.auto_release_at ? "the agreed" : "the default"} window to review.
              </span>
            </div>
          ) : null}

          {canReview ? (
            <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={approve}
                disabled={submitting}
                leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              >
                Pay & approve · ${Number(milestone.amount_usdc).toFixed(2)}
              </Button>
              <a
                href={`/app/contracts/${milestone.contract_id}/dispute?milestone=${milestone.id}`}
                className="inline-flex items-center text-body-sm text-fg-muted hover:text-danger transition-colors px-3 py-1.5"
              >
                Open dispute
              </a>
            </div>
          ) : null}

          {contractStatus === "disputed" && milestone.status === "disputed" ? (
            <a
              href={`/app/contracts/${milestone.contract_id}/arbitration`}
              className="block text-body-sm text-accent hover:underline pt-2 border-t border-border"
            >
              Watch the arbitration live →
            </a>
          ) : null}
        </div>
      ) : null}

      <SubmitDeliverableDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        contractId={milestone.contract_id}
        milestoneId={milestone.id}
        milestoneTitle={milestone.title}
      />
    </article>
  );
}
