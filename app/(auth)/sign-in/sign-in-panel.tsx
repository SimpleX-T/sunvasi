"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

function PrivyAwareSignInButton({ onAuthed }: { onAuthed: () => void }) {
  const privy = usePrivy();
  useEffect(() => {
    if (privy.authenticated) onAuthed();
  }, [privy.authenticated, onAuthed]);

  // If we know the user is already signed in, surface that instead of the
  // (useless) "Continue with email" button — the redirect fires from the
  // useEffect above so this is only on-screen for a beat.
  if (privy.ready && privy.authenticated) {
    return (
      <div className="w-full inline-flex items-center justify-center gap-2 rounded border border-border bg-bg-elevated px-5 py-3 text-body-sm text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        Already signed in — taking you to the app…
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => privy.login()}
      disabled={!privy.ready}
      className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-5 py-3 text-body-sm font-medium transition-colors duration-150 ease-sunvasi disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Mail className="h-4 w-4" />
      Continue with email
    </button>
  );
}

function FallbackSignInButton() {
  return (
    <button
      type="button"
      disabled
      className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent/40 text-accent-fg px-5 py-3 text-body-sm font-medium cursor-not-allowed"
    >
      <Mail className="h-4 w-4" />
      Continue with email
    </button>
  );
}

export function SignInPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const intent = params.get("intent");

  // Always land on /app — the onboarding gate decides whether to show the
  // first-run modal, and the intent param is preserved for follow-on routing.
  const onAuthed = () => {
    const search = intent ? `?intent=${encodeURIComponent(intent)}` : "";
    router.replace(`/app${search}`);
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display text-display-md text-fg tracking-tight">
        {intent === "create" ? "First, sign in." : "Welcome back."}
      </h1>
      <p className="mt-3 text-body-sm text-fg-muted max-w-[40ch]">
        {intent === "create"
          ? "Sunvasi uses email for sign-in. We don't take custody — your funds are held by a smart contract until you release them."
          : "Sign in to your contracts, milestones, and disputes."}
      </p>

      <div className="mt-10 space-y-3">
        {PRIVY_CONFIGURED ? (
          <PrivyAwareSignInButton onAuthed={onAuthed} />
        ) : (
          <>
            <FallbackSignInButton />
            <p className="text-body-sm text-warning font-mono">
              Auth not configured — set NEXT_PUBLIC_PRIVY_APP_ID in .env.local.
            </p>
          </>
        )}
      </div>

      <div className="mt-10 flex items-start gap-2.5 text-body-sm text-fg-subtle">
        <ShieldCheck className="h-4 w-4 mt-0.5 flex-none text-fg-subtle" />
        <p>
          By continuing, you agree to our{" "}
          <Link href="/legal/terms" className="underline hover:text-fg">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="underline hover:text-fg">
            Privacy Policy
          </Link>
          . We never store your wallet&apos;s private keys.
        </p>
      </div>
    </div>
  );
}
