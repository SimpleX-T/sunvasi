"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown, FileQuestion, FileText, FileWarning, Gavel, History, MessageCircleQuestion } from "lucide-react";
import { TOOL_NAMES, type ToolName } from "@/lib/arbitrator/tools";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<ToolName, string> = {
  [TOOL_NAMES.GET_CONTRACT_DETAILS]: "Reading the contract",
  [TOOL_NAMES.GET_MILESTONE_HISTORY]: "Reviewing milestone history",
  [TOOL_NAMES.GET_EVIDENCE]: "Reading evidence",
  [TOOL_NAMES.GET_DELIVERABLE_FILES]: "Inspecting deliverables",
  [TOOL_NAMES.REQUEST_CLARIFICATION]: "Asking for clarification",
  [TOOL_NAMES.SUBMIT_VERDICT]: "Composing verdict",
};

const TOOL_ICONS: Record<ToolName, typeof FileText> = {
  [TOOL_NAMES.GET_CONTRACT_DETAILS]: FileText,
  [TOOL_NAMES.GET_MILESTONE_HISTORY]: History,
  [TOOL_NAMES.GET_EVIDENCE]: FileQuestion,
  [TOOL_NAMES.GET_DELIVERABLE_FILES]: FileWarning,
  [TOOL_NAMES.REQUEST_CLARIFICATION]: MessageCircleQuestion,
  [TOOL_NAMES.SUBMIT_VERDICT]: Gavel,
};

export interface ToolCallEvent {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
  ts: string;
  summary?: string;
}

export function ToolCallRow({ event }: { event: ToolCallEvent }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[event.name] ?? FileText;
  const label = TOOL_LABELS[event.name] ?? event.name;

  const tag = describeArgs(event);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="rounded border border-border bg-bg-elevated"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-subtle transition-colors"
      >
        <span className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border text-fg-muted bg-bg shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm text-fg truncate">{label}</p>
          {tag ? (
            <p className="font-mono text-mono-sm text-fg-subtle truncate">{tag}</p>
          ) : null}
        </div>
        <span className="font-mono text-mono-sm text-fg-subtle">
          {timeOnly(event.ts)}
        </span>
        {event.summary ? (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-fg-subtle transition-transform",
              open ? "rotate-180" : "",
            )}
          />
        ) : null}
      </button>
      {open && event.summary ? (
        <div className="border-t border-border px-4 py-3 text-body-sm text-fg-muted font-mono leading-[1.55]">
          {event.summary}
        </div>
      ) : null}
    </motion.li>
  );
}

function describeArgs(event: ToolCallEvent): string {
  switch (event.name) {
    case TOOL_NAMES.GET_EVIDENCE: {
      const party = String(event.args.party ?? "");
      return party ? `Party · ${party}` : "";
    }
    case TOOL_NAMES.REQUEST_CLARIFICATION: {
      const party = String(event.args.party ?? "");
      const q = String(event.args.question ?? "");
      return `${party}: "${q.slice(0, 80)}${q.length > 80 ? "…" : ""}"`;
    }
    case TOOL_NAMES.SUBMIT_VERDICT: {
      const rp = event.args.release_percentage;
      if (typeof rp === "number") return `Release ${rp}% to freelancer · ${event.args.confidence}`;
      return "";
    }
    default:
      return "";
  }
}

function timeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}
