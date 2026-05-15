"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

interface Props {
  className?: string;
  showLabel?: boolean;
}

export function SignOutButton({ className, showLabel = true }: Props) {
  if (!PRIVY_CONFIGURED) return null;
  return <Inner className={className} showLabel={showLabel} />;
}

function Inner({ className, showLabel }: Props) {
  const router = useRouter();
  const privy = usePrivy();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await privy.logout?.();
    } catch {
      // ignore
    }
    try {
      await fetch("/api/sign-out", { method: "POST" });
    } catch {
      // ignore
    }
    setBusy(false);
    router.push("/");
    router.refresh();
  }

  if (!privy.authenticated) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors duration-150 disabled:opacity-50",
        "px-3 py-1.5 text-body-sm no-tap",
        className,
      )}
      aria-label="Sign out"
    >
      <LogOut className="h-3.5 w-3.5" />
      {showLabel ? <span>Sign out</span> : null}
    </button>
  );
}
