"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAuthedFetch } from "@/lib/api-client";
import { formatUsdc } from "@/lib/utils";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

type Phase = "idle" | "auth" | "encoding" | "funding" | "confirming" | "done";

interface Props {
  contractId: string;
  shortId: string;
  total: number;
  visibility: "public" | "restricted";
}

export function FundContractCard(props: Props) {
  if (PRIVY_CONFIGURED) return <PrivyFundCard {...props} />;
  return <NoAuthFundCard {...props} />;
}

function PrivyFundCard({ contractId, shortId, total, visibility }: Props) {
  const router = useRouter();
  const privy = usePrivy();
  const authed = useAuthedFetch();
  const [phase, setPhase] = useState<Phase>("idle");
  const wantsFundRef = useRef(false);

  async function startFunding() {
    const userEmail =
      privy.user?.email?.address ??
      (privy.user?.google?.email as string | undefined) ??
      undefined;
    await runFunding({
      contractId,
      email: userEmail,
      authedFetch: (path, init) => authed(path, init),
      setPhase,
      onDone: () => router.refresh(),
    });
    setTimeout(() => router.push(`/app/contracts/${shortId}`), 600);
  }

  async function onFund() {
    if (!privy.ready) return;
    if (!privy.authenticated) {
      // Record intent so the effect below picks up funding once Privy login
      // completes — otherwise the user has to click Fund a second time and
      // the button gets stuck on "Signing in…".
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
    await startFunding();
  }

  // Continue funding the moment authentication completes.
  useEffect(() => {
    if (privy.authenticated && wantsFundRef.current && phase === "auth") {
      wantsFundRef.current = false;
      void startFunding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privy.authenticated, phase]);

  const label = labelForPhase(phase, visibility);

  return (
    <FundShell
      total={total}
      visibility={visibility}
      disabled={phase !== "idle"}
      loading={phase !== "idle"}
      onClick={onFund}
      label={label}
    />
  );
}

function NoAuthFundCard({ contractId, total, shortId, visibility }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  async function onFund() {
    await runFunding({
      contractId,
      authedFetch: (path, init) => fetch(path, init),
      setPhase,
      onDone: () => router.refresh(),
    });
    setTimeout(() => router.push(`/app/contracts/${shortId}`), 600);
  }
  const label = labelForPhase(phase, visibility);
  return (
    <FundShell
      total={total}
      visibility={visibility}
      disabled={phase !== "idle"}
      loading={phase !== "idle"}
      onClick={onFund}
      label={label}
    />
  );
}

async function runFunding({
  contractId,
  email,
  authedFetch,
  setPhase,
  onDone,
}: {
  contractId: string;
  email?: string;
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>;
  setPhase: (p: Phase) => void;
  onDone: () => void;
}) {
  try {
    setPhase("encoding");
    await new Promise((r) => setTimeout(r, 700));
    setPhase("funding");
    const res = await authedFetch(`/api/contracts/${contractId}/fund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(payload.message ?? payload.error ?? "Funding failed.");
    }
    setPhase("confirming");
    await new Promise((r) => setTimeout(r, 800));
    setPhase("done");
    toast.success("Funded. Contract is now active.");
    onDone();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Funding failed.");
    setPhase("idle");
  }
}

function labelForPhase(p: Phase, visibility: "public" | "restricted"): string {
  switch (p) {
    case "idle":
      return visibility === "restricted" ? "Verify & fund" : "Fund this contract";
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

function FundShell({
  total,
  visibility,
  disabled,
  loading,
  onClick,
  label,
}: {
  total: number;
  visibility: "public" | "restricted";
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-bg-elevated/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
              <Lock className="h-4 w-4" />
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
            onClick={onClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-5 py-3 text-body-sm font-medium transition-colors duration-150 ease-sunvasi disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
