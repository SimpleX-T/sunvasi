"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Eye, Loader2, LogIn, Mail, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuthedFetch } from "@/lib/api-client";
import { cn, formatUsdc } from "@/lib/utils";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

type Phase = "idle" | "auth" | "encoding" | "funding" | "confirming" | "done";

export type FundLayout = "sticky-bottom" | "inline";

interface Props {
  contractId: string;
  shortId: string;
  total: number;
  /** The named client's email on the contract (null until set). */
  clientEmail: string | null;
  /** The freelancer's Privy DID — used to detect "you're the freelancer" gracefully. */
  freelancerId?: string | null;
  /** "public" or "restricted" — affects copy only; funding always client-gated. */
  visibility?: "public" | "restricted";
  /** Where to render: a sticky footer (the public page) or inline (the app contract detail). */
  layout?: FundLayout;
  /** Optional override for the post-funding redirect. Defaults to /app/contracts/{shortId}. */
  redirectTo?: string;
}

export function FundAction(props: Props) {
  if (!PRIVY_CONFIGURED) {
    return (
      <Frame layout={props.layout ?? "sticky-bottom"} tone="muted">
        <div className="text-body-sm text-fg-muted">
          Auth not configured — funding requires Privy.
        </div>
      </Frame>
    );
  }
  return <PrivyFundAction {...props} />;
}

function PrivyFundAction({
  contractId,
  shortId,
  total,
  clientEmail,
  freelancerId,
  visibility = "public",
  layout = "sticky-bottom",
  redirectTo,
}: Props) {
  const router = useRouter();
  const privy = usePrivy();
  const authed = useAuthedFetch();
  const [phase, setPhase] = useState<Phase>("idle");

  // When the user clicks "Sign in to continue", we set wantsFundRef so that
  // once Privy auth completes, we proceed automatically without a second
  // click.
  const wantsFundRef = useRef(false);

  const viewerEmail =
    privy.user?.email?.address?.toLowerCase() ??
    (privy.user?.google?.email as string | undefined)?.toLowerCase() ??
    null;
  const viewerDid = privy.user?.id ?? null;

  const clientEmailLower = clientEmail?.toLowerCase() ?? null;
  const noClientYet = !clientEmailLower;
  const isClient =
    privy.authenticated &&
    (!!viewerEmail && !!clientEmailLower && viewerEmail === clientEmailLower);
  const isFreelancer =
    privy.authenticated && !!freelancerId && !!viewerDid && viewerDid === freelancerId;

  // First-time-funding allowance: if no client_email is set yet on the
  // contract, whoever signs in and funds becomes the client.
  const canFund = privy.authenticated && (isClient || (noClientYet && !isFreelancer));

  // Auto-progress after sign-in: if the user clicked Fund while logged out,
  // we kicked off Privy login; once we have auth, complete the funding.
  useEffect(() => {
    if (!privy.authenticated) return;
    if (!wantsFundRef.current) return;
    if (!canFund) {
      wantsFundRef.current = false;
      return;
    }
    wantsFundRef.current = false;
    void runFund();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privy.authenticated, canFund]);

  async function runFund() {
    setPhase("encoding");
    await new Promise((r) => setTimeout(r, 600));
    setPhase("funding");
    try {
      const res = await authed(`/api/contracts/${contractId}/fund`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(payload.message ?? payload.error ?? "Funding failed.");
      }
      setPhase("confirming");
      await new Promise((r) => setTimeout(r, 800));
      setPhase("done");
      toast.success("Funded. Contract is now active.");
      const dest = redirectTo ?? `/app/contracts/${shortId}`;
      setTimeout(() => router.push(dest), 600);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Funding failed.");
      setPhase("idle");
    }
  }

  async function onCta() {
    if (!privy.authenticated) {
      wantsFundRef.current = true;
      setPhase("auth");
      try {
        await privy.login();
      } catch {
        wantsFundRef.current = false;
        setPhase("idle");
      }
      return;
    }
    if (!canFund) {
      // Shouldn't happen because the CTA is hidden — but guard anyway.
      return;
    }
    await runFund();
  }

  /* ----------------- render branches ----------------- */

  // 1. NOT signed in — universal "Sign in to continue" with single-click sign-in-and-fund
  if (!privy.authenticated) {
    return (
      <Frame layout={layout} tone="prompt">
        <div className="flex items-baseline gap-4">
          <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
            Total
          </p>
          <p className="font-mono text-display-sm text-fg tabular-nums">
            ${formatUsdc(total)} <span className="text-fg-subtle text-mono">USDC</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 text-body-sm text-fg-subtle">
            <ShieldCheck className="h-4 w-4" />
            Non-custodial · Stellar
          </span>
          <button
            type="button"
            onClick={onCta}
            disabled={phase !== "idle"}
            className="inline-flex items-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-5 py-3 text-body-sm font-medium transition-colors duration-150 ease-sunvasi disabled:opacity-70"
          >
            {phase === "auth" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {phase === "auth" ? "Opening sign-in…" : "Sign in to fund"}
          </button>
        </div>
      </Frame>
    );
  }

  // 2. Signed in as the client (or first-funder) — render the funding button.
  if (canFund) {
    return (
      <Frame layout={layout} tone="action">
        <div className="flex items-baseline gap-4">
          <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
            Total
          </p>
          <p className="font-mono text-display-sm text-fg tabular-nums">
            ${formatUsdc(total)} <span className="text-fg-subtle text-mono">USDC</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {visibility === "restricted" ? (
            <span className="hidden md:inline-flex items-center gap-1.5 text-body-sm text-warning">
              <ShieldCheck className="h-4 w-4" />
              Invitation-only
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1.5 text-body-sm text-fg-subtle">
              <ShieldCheck className="h-4 w-4" />
              Non-custodial · Stellar
            </span>
          )}
          <button
            type="button"
            onClick={onCta}
            disabled={phase !== "idle"}
            className="inline-flex items-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-5 py-3 text-body-sm font-medium transition-colors duration-150 ease-sunvasi disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {phase === "idle" || phase === "auth" ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {labelForPhase(phase)}
          </button>
        </div>
      </Frame>
    );
  }

  // 3. Signed in but you're not the client — view-only state.
  return (
    <Frame layout={layout} tone="muted">
      <div className="flex items-start gap-3 text-body-sm">
        <Eye className="h-4 w-4 mt-0.5 text-fg-subtle shrink-0" />
        <div className="space-y-1">
          <p className="text-fg">
            {isFreelancer
              ? "You're the freelancer on this contract. Funding waits on the client."
              : "You have view access. Only the named client can fund this contract."}
          </p>
          {clientEmail ? (
            <p className="text-fg-subtle">
              Client: <code className="font-mono text-fg">{clientEmail}</code>
            </p>
          ) : null}
          {!isFreelancer && viewerEmail ? (
            <p className="text-fg-subtle">
              You signed in as <code className="font-mono text-fg">{viewerEmail}</code>.
            </p>
          ) : null}
        </div>
      </div>
      {!isFreelancer ? (
        <a
          href="mailto:?subject=Sign%20in%20with%20a%20different%20email"
          className="hidden md:inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-fg transition-colors"
        >
          <Mail className="h-3.5 w-3.5" />
          Wrong account?
        </a>
      ) : null}
    </Frame>
  );
}

function labelForPhase(p: Phase): string {
  switch (p) {
    case "idle":
      return "Fund this contract";
    case "auth":
      return "Signing in…";
    case "encoding":
      return "Encoding your contract…";
    case "funding":
      return "Funding escrow…";
    case "confirming":
      return "Confirming on-chain…";
    case "done":
      return "Funded";
  }
}

function Frame({
  layout,
  tone,
  children,
}: {
  layout: FundLayout;
  tone: "action" | "prompt" | "muted";
  children: React.ReactNode;
}) {
  if (layout === "sticky-bottom") {
    return (
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-bg-elevated/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-lg border p-5 lg:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
        tone === "action"
          ? "border-accent/40 bg-accent/5"
          : tone === "prompt"
            ? "border-warning/30 bg-warning/5"
            : "border-border bg-bg-elevated",
      )}
    >
      {children}
    </div>
  );
}
