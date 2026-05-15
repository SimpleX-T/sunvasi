"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ToolCallRow, type ToolCallEvent } from "./tool-call-row";
import { VerdictCard, type VerdictDisplay } from "./verdict-card";

interface Props {
  disputeId: string;
}

export function ArbitrationLiveView({ disputeId }: Props) {
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [verdict, setVerdict] = useState<VerdictDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource(`/api/arbitration/${disputeId}`);
    setPhase("running");

    es.addEventListener("started", () => {
      setStreamingText("");
    });

    es.addEventListener("text", (e) => {
      const { delta } = JSON.parse((e as MessageEvent).data) as { delta: string };
      setStreamingText((prev) => prev + delta);
    });

    es.addEventListener("tool_call", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as ToolCallEvent;
      if (seenIdsRef.current.has(data.id)) return;
      seenIdsRef.current.add(data.id);
      setToolCalls((prev) => [...prev, data]);
    });

    es.addEventListener("tool_result", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { id: string; summary: string };
      setToolCalls((prev) =>
        prev.map((tc) => (tc.id === data.id ? { ...tc, summary: data.summary } : tc)),
      );
    });

    es.addEventListener("verdict", (e) => {
      const v = JSON.parse((e as MessageEvent).data) as VerdictDisplay;
      setVerdict(v);
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data ?? "{}") as { message?: string };
        if (data.message) setError(data.message);
      } catch {
        // browser-level error: stream closed by server
      }
    });

    es.addEventListener("done", () => {
      setPhase("done");
      es.close();
    });

    return () => es.close();
  }, [disputeId]);

  return (
    <div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <section>
          <header className="flex items-baseline justify-between mb-4">
            <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle">
              Tool-call timeline
            </h2>
            {phase === "running" ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-mono-sm text-accent">
                <Loader2 className="h-3 w-3 animate-spin" />
                live
              </span>
            ) : null}
          </header>

          <ol className="space-y-2.5">
            {toolCalls.length === 0 && !verdict ? (
              <SkeletonRow label="Connecting to the arbitrator…" />
            ) : null}
            {toolCalls.map((tc) => (
              <ToolCallRow key={tc.id} event={tc} />
            ))}
          </ol>
        </section>

        <aside>
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Reasoning</h2>
            <span className="font-mono text-mono-sm text-fg-subtle">
              {streamingText.length} chars
            </span>
          </header>
          <div className="rounded-lg border border-border bg-bg-elevated p-5 min-h-[280px] font-mono text-mono-sm text-fg leading-[1.7] whitespace-pre-wrap overflow-y-auto max-h-[60vh]">
            {streamingText || (
              <span className="text-fg-subtle italic">Waiting for the arbitrator…</span>
            )}
            {phase === "running" ? (
              <span className="inline-block w-2 h-4 ml-0.5 align-text-bottom bg-accent animate-caret-blink" />
            ) : null}
          </div>
        </aside>
      </div>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded border border-danger/30 bg-danger/5 px-5 py-4 text-body-sm text-danger font-mono"
        >
          {error}
        </motion.div>
      ) : null}

      {verdict ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          <VerdictCard verdict={verdict} />
        </motion.div>
      ) : null}
    </div>
  );
}

function SkeletonRow({ label }: { label: string }) {
  return (
    <li className="rounded border border-border bg-bg-elevated px-4 py-3 flex items-center gap-3">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
      <span className="text-body-sm text-fg-muted font-mono">{label}</span>
    </li>
  );
}
