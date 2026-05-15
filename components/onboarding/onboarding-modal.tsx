"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Briefcase, Building2, Check, Copy, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SkillsPicker } from "@/components/skills-picker";
import { useAuthedFetch } from "@/lib/api-client";
import type { ProfileRole, ProfileRow } from "@/lib/supabase";
import { cn, shortenAddress } from "@/lib/utils";

interface Props {
  open: boolean;
  email: string;
  walletAddress?: string | null;
  initial?: Partial<ProfileRow> | null;
  onClose: (didFinish: boolean) => void;
}

const ROLES: Array<{ id: ProfileRole; title: string; subtitle: string; icon: typeof Briefcase }> = [
  {
    id: "freelancer",
    title: "Freelancer",
    subtitle: "I do the work. I get paid in USDC, off-ramp to local currency.",
    icon: Briefcase,
  },
  {
    id: "client",
    title: "Client",
    subtitle: "I hire and fund work. I want a clean, no-crypto-friction flow.",
    icon: Building2,
  },
  {
    id: "both",
    title: "Both",
    subtitle: "I hire some weeks and freelance others. Mix it up.",
    icon: Users,
  },
];

export function OnboardingModal({ open, email, walletAddress, initial, onClose }: Props) {
  const router = useRouter();
  const authed = useAuthedFetch();

  const [step, setStep] = useState(0);
  const [role, setRole] = useState<ProfileRole>(initial?.role ?? "freelancer");
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function finish() {
    setSubmitting(true);
    try {
      const res = await authed("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          email,
          display_name: displayName.trim() || undefined,
          role,
          skills,
          bio: bio.trim() || null,
          // NOTE: do not pass payout_address here. Privy's default wallet on
          // the user object is the EVM embedded wallet (0x...). The server
          // side provisions the Stellar wallet (G...) and sets the correct
          // payout_address itself — overriding it from here would clobber
          // the Stellar address and break on-chain funding.
          mark_onboarded: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Welcome to Sunvasi.");
      onClose(true);
      router.refresh();
    } catch {
      toast.error("Couldn't save profile. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canAdvanceFromStep0 = role !== undefined && displayName.trim().length > 0;
  const skipWalletStep = role === "client";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose(false);
      }}
    >
      <DialogContent
        hideClose
        className="max-w-[560px] p-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Set up your Sunvasi profile</DialogTitle>
        <DialogDescription className="sr-only">
          A three-step setup: role and name, payout details, and a confirmation screen.
        </DialogDescription>
        <div className="px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between">
          <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
            {step + 1} / 3 · Setting you up
          </p>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="text-fg-subtle hover:text-fg transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="px-6 lg:px-8 pb-6 pt-2 space-y-6"
            >
              <header>
                <h2 className="font-display text-display-md text-fg tracking-tight">
                  Welcome. What do you do?
                </h2>
                <p className="mt-2 text-body-sm text-fg-muted max-w-[44ch]">
                  This shapes what you see on your dashboard. You can change it later.
                </p>
              </header>

              <div className="grid gap-2.5">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const active = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={cn(
                        "text-left flex items-start gap-3 rounded border px-4 py-3 transition-colors duration-150",
                        active
                          ? "border-accent bg-accent/5"
                          : "border-border bg-bg hover:border-border-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 h-7 w-7 rounded inline-flex items-center justify-center border",
                          active ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-fg-muted",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-body text-fg">{r.title}</p>
                        <p className="text-body-sm text-fg-muted">{r.subtitle}</p>
                      </div>
                      {active ? (
                        <Check className="h-4 w-4 text-accent mt-1" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <Input
                label="Display name"
                placeholder={role === "client" ? "David Engel" : "Amara Okafor"}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              {role !== "client" ? (
                <div>
                  <label className="text-caption uppercase tracking-[0.16em] text-fg-muted">
                    Skills
                  </label>
                  <div className="mt-1.5">
                    <SkillsPicker
                      value={skills}
                      onChange={setSkills}
                      max={20}
                      catalogMaxHeight="220px"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end pt-2">
                <Button
                  variant="primary"
                  onClick={() => setStep(skipWalletStep ? 2 : 1)}
                  disabled={!canAdvanceFromStep0}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          ) : null}

          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="px-6 lg:px-8 pb-6 pt-2 space-y-6"
            >
              <header>
                <h2 className="font-display text-display-md text-fg tracking-tight">
                  Where should your money go?
                </h2>
                <p className="mt-2 text-body-sm text-fg-muted max-w-[48ch]">
                  USDC will land at the wallet address below. You can off-ramp to Naira via
                  Yellow Card, Onboard, or Busha — or hold the USDC.
                </p>
              </header>

              <div className="rounded border border-border bg-bg p-4">
                <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Payout address</p>
                {walletAddress ? (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="font-mono text-mono text-fg break-all">
                      {shortenAddress(walletAddress, 14, 10)}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(walletAddress).catch(() => undefined);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      }}
                      className="inline-flex items-center gap-1 text-caption uppercase tracking-[0.14em] text-fg-muted hover:text-fg"
                    >
                      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-body-sm text-fg-subtle italic">
                    No wallet yet — Sunvasi will create one for you on first contract creation, or you can connect Freighter from Settings.
                  </p>
                )}
              </div>

              <Textarea
                label="Bio (optional)"
                placeholder="A line or two for clients. What do you ship, and for whom?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  className="text-body-sm text-fg-muted hover:text-fg"
                  onClick={() => setStep(0)}
                >
                  Back
                </button>
                <Button
                  variant="primary"
                  onClick={() => setStep(2)}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="px-6 lg:px-8 pb-8 pt-2 space-y-6"
            >
              <header className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-accent mt-1" />
                <div>
                  <h2 className="font-display text-display-md text-fg tracking-tight">
                    You&apos;re set.
                  </h2>
                  <p className="mt-2 text-body-sm text-fg-muted">
                    Your contracts are waiting. Here&apos;s what you can do right now:
                  </p>
                </div>
              </header>

              <ul className="space-y-2 text-body-sm text-fg-muted pl-1">
                {role === "freelancer" || role === "both" ? (
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
                    Create a contract and send the funding link to a client.
                  </li>
                ) : null}
                {role === "client" || role === "both" ? (
                  <li className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
                    A freelancer will share a funding link with you — open it to fund the escrow.
                  </li>
                ) : null}
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
                  Watch the demo arbitration to see how disputes resolve.
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
                  Update your profile from the sidebar anytime.
                </li>
              </ul>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  className="text-body-sm text-fg-muted hover:text-fg"
                  onClick={() => setStep(skipWalletStep ? 0 : 1)}
                >
                  Back
                </button>
                <Button
                  variant="primary"
                  onClick={finish}
                  loading={submitting}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  {role === "freelancer" || role === "both" ? "Create my first contract" : "Take me to my dashboard"}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
