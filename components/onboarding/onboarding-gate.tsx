"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/lib/api-client";
import { OnboardingModal } from "./onboarding-modal";
import type { ProfileRow } from "@/lib/supabase";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

/* ---------------------------------------------------------------------------
 * Listens for Privy authentication, fetches the user's profile, and shows the
 * onboarding modal until `onboarded_at` is set. Mounted globally inside the
 * (app) layout so every authenticated route triggers it.
 * ------------------------------------------------------------------------ */

export function OnboardingGate() {
  if (!PRIVY_CONFIGURED) return null;
  return <Inner />;
}

function Inner() {
  const privy = usePrivy();
  const router = useRouter();
  const authed = useAuthedFetch();

  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (!privy.ready || !privy.authenticated || checked) return;
    const user = privy.user;
    if (!user) return;

    const userEmail =
      user.email?.address ??
      (user.google?.email as string | undefined) ??
      "";
    setEmail(userEmail);
    const wallet =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (user.wallet as { address?: string } | undefined)?.address ?? null;
    setWalletAddress(wallet);

    (async () => {
      try {
        const url = userEmail
          ? `/api/profile?email=${encodeURIComponent(userEmail)}`
          : "/api/profile";
        const res = await authed(url);
        if (!res.ok) return;
        const data = (await res.json()) as { profile: ProfileRow | null };
        setProfile(data.profile);
        if (!data.profile || !data.profile.onboarded_at) {
          setOpen(true);
        }
      } finally {
        setChecked(true);
      }
    })();
  }, [privy.ready, privy.authenticated, privy.user, authed, checked]);

  function handleClose(didFinish: boolean) {
    setOpen(false);
    if (didFinish) router.refresh();
  }

  if (!open) return null;
  return (
    <OnboardingModal
      open={open}
      email={email}
      walletAddress={walletAddress}
      initial={profile}
      onClose={handleClose}
    />
  );
}
