import { Check, Clock, FileUp, Gavel, Mail, Pencil, Sparkles, Wallet, X } from "lucide-react";
import type { ActivityRow } from "@/lib/supabase";
import { relativeTime } from "@/lib/utils";

const ICONS: Record<string, typeof Check> = {
  created: Sparkles,
  edited: Pencil,
  invited: Mail,
  funded: Wallet,
  submitted: FileUp,
  approved: Check,
  released: Check,
  auto_released: Clock,
  disputed: Gavel,
  verdict: Gavel,
  cancelled: X,
};

const LABELS: Record<string, string> = {
  created: "Contract created",
  edited: "Contract edited",
  invited: "Invitation sent to client",
  funded: "Funded",
  submitted: "Milestone submitted",
  approved: "Milestone approved",
  released: "Funds released",
  auto_released: "Auto-released to freelancer",
  disputed: "Dispute opened",
  verdict: "Verdict reached",
  cancelled: "Cancelled",
};

export function ActivityTimeline({ events }: { events: ActivityRow[] }) {
  if (events.length === 0) {
    return (
      <div className="text-body-sm text-fg-subtle italic px-1 py-2">
        No activity yet. Events will appear here as the contract progresses.
      </div>
    );
  }
  return (
    <ol className="space-y-4">
      {events.map((ev) => {
        const Icon = ICONS[ev.type] ?? Sparkles;
        const label = LABELS[ev.type] ?? ev.type;
        return (
          <li key={ev.id} className="flex items-start gap-3">
            <span className="mt-0.5 h-7 w-7 inline-flex items-center justify-center rounded-full border border-border text-fg-muted bg-bg-elevated shrink-0">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1 min-w-0 pb-2">
              <p className="text-body-sm text-fg">{label}</p>
              <p className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.12em]">
                {relativeTime(ev.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
