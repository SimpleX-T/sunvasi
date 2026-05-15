"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, FileText, Link2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitDeliverableDialog } from "@/components/contract/submit-deliverable-dialog";
import { formatUsdc } from "@/lib/utils";
import type { MilestoneRow, DeliverableFile, DeliverableLink } from "@/lib/supabase";

/** ms → "2m 47s" / "1h 04m" / "12s" — drops trailing zero units. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

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
      const res = await fetch(`/api/milestones/${milestone.id}/approve`, {
        method: "POST",
      });
      const rawText = await res.text();
      let payload: {
        error?: string;
        message?: string;
        stage?: string;
        body?: { message?: string; details?: Record<string, string[]> };
      } = {};
      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        // Non-JSON response. Treat the raw text as the message.
        payload = { message: rawText.slice(0, 240) };
      }

      if (!res.ok) {
        // Prefer the upstream TW validation detail when present — it tells the
        // user (and us) which field actually failed.
        const fieldErrors = payload.body?.details
          ? Object.entries(payload.body.details)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
              .join("; ")
          : null;
        const stage = payload.stage;
        const stageHint =
          stage === "fund"
            ? "USDC didn't move into escrow."
            : stage === "approve"
              ? "TW rejected the approval."
              : stage === "release"
                ? "Approved but couldn't release — retry."
                : null;
        const message =
          fieldErrors ??
          payload.message ??
          payload.body?.message ??
          stageHint ??
          `HTTP ${res.status} — see dev-server console for the full response.`;
        console.error("approve.failed", { status: res.status, payload });
        toast.error(message);
        return;
      }
      toast.success(
        `Paid $${Number(milestone.amount_usdc).toFixed(2)} and released to freelancer.`,
      );
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error while approving.";
      console.error("approve.threw", e);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Live ticker for the auto-release countdown — re-renders every second so
  // the countdown actually ticks down in real time instead of showing the
  // stale value from the original page render.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (milestone.status !== "submitted") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [milestone.status]);

  // Auto-release status copy is role-aware. Three states:
  //   • future    → live countdown (e.g. "Auto-releases in 2m 47s")
  //   • due now-ish (within the next balance-poll window) → "Releasing now…"
  //   • overdue (the worker hasn't fired yet for whatever reason) → role-aware reminder
  const autoReleaseInfo = (() => {
    if (milestone.status !== "submitted" || !milestone.auto_release_at) return null;
    const due = new Date(milestone.auto_release_at).getTime();
    const remaining = due - now;
    if (remaining > 0) {
      return {
        label: `Auto-releases in ${formatCountdown(remaining)}`,
        tone: "warning" as const,
      };
    }
    // Within ~30s past the deadline the balance-poll worker should fire.
    // Surface a "releasing now" hint so the freelancer sees motion.
    if (remaining > -30_000) {
      return {
        label: "Releasing now…",
        tone: "warning" as const,
      };
    }
    return {
      label:
        role === "client"
          ? "Auto-release window ended — review and pay below"
          : "Awaiting client review",
      tone: "danger" as const,
    };
  })();

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
            {autoReleaseInfo ? (
              <span
                className={`font-mono text-mono-sm ${
                  autoReleaseInfo.tone === "danger" ? "text-danger" : "text-warning"
                }`}
              >
                {autoReleaseInfo.label}
              </span>
            ) : null}
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
