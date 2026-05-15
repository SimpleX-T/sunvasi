"use client";

import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Loader2,
  RefreshCcw,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Status = "ok" | "warn" | "fail" | "unconfigured";

interface CheckResult {
  status: Status;
  latency_ms?: number;
  detail: string;
  hint?: string;
  config_present: boolean;
}

interface Report {
  generated_at: string;
  checks: Record<string, CheckResult>;
}

const LABELS: Record<string, string> = {
  supabase: "Supabase",
  privy: "Privy (auth)",
  privy_stellar: "Privy → Stellar (server signer)",
  cloudinary: "Cloudinary (uploads)",
  gemini: "Gemini (arbitrator)",
  resend: "Resend (email)",
  trustless_work: "Trustless Work",
  stellar_rpc: "Stellar RPC",
};

const DESCRIPTIONS: Record<string, string> = {
  supabase: "Database + storage. Reads write to /rest/v1/contracts to verify the schema is in place.",
  privy: "Email + wallet auth. The server side only checks config presence; client login is verified by Privy directly.",
  privy_stellar:
    "Server-side raw-sign for Stellar transactions via Privy's REST API. Required for on-chain funding when TRUSTLESS_WORK_API_KEY is set. Without it, funding falls back to mock mode.",
  cloudinary: "Signs uploads for milestone deliverables and avatars.",
  gemini: "The AI arbitrator + 'Suggest milestones'. We probe Google's model-list endpoint.",
  resend: "Outbound invitation emails. Without it, share falls back to mailto:.",
  trustless_work: "Non-custodial escrow REST API. We hit the indexer to verify auth + reachability.",
  stellar_rpc: "Soroban RPC for chain reads. Used by the wallet signing flow on the client.",
};

const ICONS: Record<Status, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
  unconfigured: CircleOff,
};

const TONES: Record<Status, string> = {
  ok: "border-success/40 bg-success/5 text-success",
  warn: "border-warning/40 bg-warning/5 text-warning",
  fail: "border-danger/40 bg-danger/5 text-danger",
  unconfigured: "border-border bg-bg-elevated text-fg-subtle",
};

export function DiagnosticsBoard() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/diagnostics", { cache: "no-store" });
      const data = (await res.json()) as Report;
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const entries = report ? Object.entries(report.checks) : [];

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
            {report ? new Date(report.generated_at).toLocaleString() : "Loading…"}
          </p>
          <h2 className="mt-1 font-display text-display-sm tracking-tight text-fg">
            Integration health
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          leftIcon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
        >
          Re-run checks
        </Button>
      </header>

      <ul className="grid gap-3">
        {loading && !report
          ? Array.from({ length: 7 }).map((_, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-bg-elevated h-20 shimmer"
              />
            ))
          : entries.map(([key, c]) => {
              const Icon = ICONS[c.status];
              return (
                <li
                  key={key}
                  className={cn(
                    "rounded-lg border bg-bg-elevated p-5 grid grid-cols-[28px_1fr_auto] gap-4 items-start",
                    TONES[c.status],
                  )}
                >
                  <Icon className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="text-body text-fg flex items-center gap-2">
                      <span>{LABELS[key] ?? key}</span>
                      <StatusPill status={c.status} />
                    </p>
                    <p className="text-body-sm text-fg-muted mt-1">{c.detail}</p>
                    <p className="text-body-sm text-fg-subtle mt-2 max-w-[60ch]">
                      {DESCRIPTIONS[key]}
                    </p>
                    {c.hint ? (
                      <p className="text-body-sm text-fg-subtle mt-2 italic">→ {c.hint}</p>
                    ) : null}
                  </div>
                  {typeof c.latency_ms === "number" ? (
                    <span className="font-mono text-mono-sm text-fg-subtle tabular-nums whitespace-nowrap">
                      {c.latency_ms}ms
                    </span>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
      </ul>

      <TwLiveTest />
      <ReprovisionPanel />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Re-provision the signed-in user's Stellar wallet + trustline               */
/* ------------------------------------------------------------------------- */

interface ReprovisionResult {
  ok: boolean;
  did?: string;
  address?: string;
  steps: Array<{ name: string; ok: boolean; detail?: string }>;
  error?: string;
}

function ReprovisionPanel() {
  const authed = useAuthedFetch();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReprovisionResult | null>(null);

  async function run(force: boolean) {
    setBusy(true);
    try {
      const path = force
        ? "/api/diagnostics/reprovision?force=1"
        : "/api/diagnostics/reprovision";
      const res = await authed(path, { method: "POST" });
      setResult((await res.json()) as ReprovisionResult);
    } catch (e) {
      setResult({
        ok: false,
        steps: [],
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-6 space-y-5">
      <header className="flex items-start gap-4">
        <Wallet className="h-5 w-5 text-accent mt-1" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-display-sm tracking-tight text-fg">
            Re-provision your Stellar wallet
          </h3>
          <p className="mt-1 text-body-sm text-fg-muted max-w-[68ch]">
            Forces a fresh run of the wallet pipeline for the signed-in user:
            (1) ensure a Privy Stellar wallet exists, (2) activate it on-chain
            via Friendbot, (3) establish the USDC trustline. Use{" "}
            <strong className="text-fg">Force re-provision</strong> if you&apos;re
            hitting 401s on raw_sign — that wipes any stranded owner-bound
            wallet and creates a fresh app-owned one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run(false)}
            disabled={busy}
            leftIcon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          >
            Re-provision
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => run(true)}
            disabled={busy}
            leftIcon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          >
            Force re-provision
          </Button>
        </div>
      </header>

      {result ? (
        <div className={cn("rounded border p-4", TONES[result.ok ? "ok" : "fail"])}>
          {result.address ? (
            <p className="font-mono text-mono-sm text-fg break-all mb-3">
              {result.address}
            </p>
          ) : null}
          <ol className="space-y-2">
            {result.steps.map((s) => (
              <li key={s.name} className="flex items-start gap-3 text-body-sm">
                {s.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 text-danger" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-fg font-mono">{s.name}</p>
                  {s.detail ? (
                    <p className="text-fg-muted">{s.detail}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {result.error ? (
            <p className="mt-2 text-body-sm text-danger">{result.error}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded border border-dashed border-border bg-bg p-4 text-body-sm text-fg-subtle italic">
          Click <strong className="text-fg">Re-provision</strong> to retry wallet setup with full
          error visibility.
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: Status }) {
  const labels: Record<Status, string> = {
    ok: "OK",
    warn: "Warning",
    fail: "Failing",
    unconfigured: "Unconfigured",
  };
  return (
    <span className="inline-flex items-center rounded border border-current/40 px-1.5 py-0 font-mono text-mono-sm uppercase tracking-[0.14em]">
      {labels[status]}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Trustless Work end-to-end smoke test                                       */
/* ------------------------------------------------------------------------- */

interface TwTestResponse {
  ok: boolean;
  stage: string;
  latency_ms?: number;
  network?: string;
  base_url?: string;
  engagement_id?: string;
  unsigned_xdr_preview?: string | null;
  message?: string;
  body?: unknown;
  raw?: unknown;
  parties?: Record<string, string>;
}

function TwLiveTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TwTestResponse | null>(null);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/diagnostics/tw-test", { method: "POST" });
      setResult((await res.json()) as TwTestResponse);
    } finally {
      setBusy(false);
    }
  }

  const tone: Status = !result
    ? "unconfigured"
    : result.ok
      ? "ok"
      : result.stage === "config"
        ? "unconfigured"
        : "fail";
  const ToneIcon = ICONS[tone];

  return (
    <section className="rounded-lg border border-border bg-bg-elevated p-6 space-y-5">
      <header className="flex items-start gap-4">
        <Zap className="h-5 w-5 text-accent mt-1" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-display-sm tracking-tight text-fg">
            Trustless Work — live escrow dry-run
          </h3>
          <p className="mt-1 text-body-sm text-fg-muted max-w-[68ch]">
            Generates 5 throwaway Stellar keypairs, calls{" "}
            <code className="font-mono text-fg">/deployer/multi-release</code> with a 1 USDC test
            milestone, and confirms TW returns an unsigned XDR. Nothing is signed or
            broadcast — no real funds at risk.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={run}
          disabled={busy}
          leftIcon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        >
          Run dry-run
        </Button>
      </header>

      {result ? (
        <div className={cn("rounded border p-4", TONES[tone])}>
          <div className="flex items-center gap-2 text-body-sm">
            <ToneIcon className="h-4 w-4" />
            <span className="text-fg">{result.message}</span>
          </div>
          <dl className="mt-3 grid grid-cols-[140px_1fr] gap-x-4 gap-y-1.5 font-mono text-mono-sm text-fg-subtle">
            {result.stage ? (
              <>
                <dt>stage</dt>
                <dd className="text-fg break-all">{result.stage}</dd>
              </>
            ) : null}
            {result.network ? (
              <>
                <dt>network</dt>
                <dd className="text-fg">{result.network}</dd>
              </>
            ) : null}
            {result.base_url ? (
              <>
                <dt>base_url</dt>
                <dd className="text-fg break-all">{result.base_url}</dd>
              </>
            ) : null}
            {typeof result.latency_ms === "number" ? (
              <>
                <dt>latency</dt>
                <dd className="text-fg tabular-nums">{result.latency_ms} ms</dd>
              </>
            ) : null}
            {result.engagement_id ? (
              <>
                <dt>engagement_id</dt>
                <dd className="text-fg break-all">{result.engagement_id}</dd>
              </>
            ) : null}
            {result.unsigned_xdr_preview ? (
              <>
                <dt>unsigned_xdr</dt>
                <dd className="text-fg break-all">{result.unsigned_xdr_preview}</dd>
              </>
            ) : null}
          </dl>
          {result.parties ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-mono-sm text-fg-subtle hover:text-fg">
                generated parties (public keys only)
              </summary>
              <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-4 gap-y-1 font-mono text-mono-sm text-fg-subtle">
                {Object.entries(result.parties).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt>{k}</dt>
                    <dd className="text-fg break-all">{v}</dd>
                  </Fragment>
                ))}
              </dl>
            </details>
          ) : null}
          {result.body || result.raw ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-mono-sm text-fg-subtle hover:text-fg">
                raw response
              </summary>
              <pre className="mt-2 overflow-x-auto rounded border border-border bg-bg p-3 font-mono text-mono-sm text-fg-muted whitespace-pre-wrap">
                {JSON.stringify(result.body ?? result.raw, null, 2)}
              </pre>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="rounded border border-dashed border-border bg-bg p-4 text-body-sm text-fg-subtle italic">
          Click <strong className="text-fg">Run dry-run</strong> to hit Trustless Work end-to-end.
        </div>
      )}
    </section>
  );
}
