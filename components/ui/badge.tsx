import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dotted?: boolean;
}

const tones: Record<Tone, string> = {
  neutral: "text-fg-muted border-border",
  accent: "text-accent border-accent/40 bg-accent/5",
  success: "text-success border-success/40 bg-success/5",
  warning: "text-warning border-warning/40 bg-warning/5",
  danger: "text-danger border-danger/40 bg-danger/5",
  info: "text-fg border-border-strong",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-fg-muted",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-fg",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone = "neutral", dotted, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-caption uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dotted ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])} aria-hidden />
      ) : null}
      {children}
    </span>
  );
});

/* ------------------------------------------------------------------------- */
/* Status badge — maps contract / milestone statuses to tone + label.        */
/* ------------------------------------------------------------------------- */

const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  awaiting_funding: { tone: "warning", label: "Awaiting funding" },
  active: { tone: "accent", label: "Active" },
  completed: { tone: "success", label: "Completed" },
  disputed: { tone: "danger", label: "Disputed" },
  resolved: { tone: "info", label: "Resolved" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  pending: { tone: "neutral", label: "Pending" },
  in_progress: { tone: "accent", label: "In progress" },
  submitted: { tone: "warning", label: "Submitted" },
  approved: { tone: "success", label: "Approved" },
  released: { tone: "success", label: "Released" },
  refunded: { tone: "info", label: "Refunded" },
  arbitrating: { tone: "accent", label: "Arbitrating" },
  escalated: { tone: "danger", label: "Escalated" },
  open: { tone: "warning", label: "Open" },
  evidence_collection: { tone: "warning", label: "Evidence" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS_MAP[status] ?? { tone: "neutral" as const, label: status };
  return (
    <Badge tone={entry.tone} dotted className={className}>
      {entry.label}
    </Badge>
  );
}
