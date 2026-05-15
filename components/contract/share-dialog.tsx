"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  Plus,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ContractVisibility } from "@/lib/supabase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  shortId: string;
  clientEmail: string | null;
  initialVisibility: ContractVisibility;
  initialInvitees: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ShareDialog({
  open,
  onOpenChange,
  contractId,
  shortId,
  clientEmail,
  initialVisibility,
  initialInvitees,
}: Props) {
  const router = useRouter();
  const authed = useAuthedFetch();

  const [visibility, setVisibility] = useState<ContractVisibility>(initialVisibility);
  const [invitees, setInvitees] = useState<string[]>(initialInvitees);
  const [pendingEmail, setPendingEmail] = useState("");
  const [sendOnAdd, setSendOnAdd] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkOrigin, setLinkOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setLinkOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setVisibility(initialVisibility);
    setInvitees(initialInvitees);
  }, [initialVisibility, initialInvitees, open]);

  const url = `${linkOrigin}/c/${shortId}`;

  // Display order: the original client_email first (tagged "Client"), then any others.
  const orderedInvitees = (() => {
    const lower = invitees.map((s) => s.toLowerCase());
    const ce = clientEmail?.toLowerCase();
    const set = new Set(lower);
    if (ce) set.add(ce);
    const out: string[] = [];
    if (ce && set.has(ce)) out.push(ce);
    for (const e of lower) if (e !== ce) out.push(e);
    return out;
  })();

  async function addInvitee() {
    const email = pendingEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast.error("Enter a valid email.");
      return;
    }
    if (invitees.map((s) => s.toLowerCase()).includes(email) || email === clientEmail?.toLowerCase()) {
      toast.message("Already on the list.");
      setPendingEmail("");
      return;
    }
    setSaving(true);
    try {
      const nextList = Array.from(new Set([...invitees, email]));
      const res = await authed(`/api/contracts/${contractId}/share`, {
        method: "POST",
        body: JSON.stringify({
          invitee_emails: nextList,
          send_to: sendOnAdd ? [email] : undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        invitee_emails?: string[];
        send_results?: Array<{ to: string; ok: boolean; error?: string }>;
        message?: string;
      };
      if (!res.ok || !payload.ok) {
        toast.error(payload.message ?? "Couldn't add invitee.");
        return;
      }
      setInvitees(payload.invitee_emails ?? nextList);
      setPendingEmail("");
      const sendResult = payload.send_results?.find((r) => r.to === email);
      if (sendOnAdd && sendResult && !sendResult.ok) {
        toast.message(sendResult.error ?? "Added, but invitation email wasn't sent.");
      } else if (sendOnAdd && sendResult?.ok) {
        toast.success(`Invitation sent to ${email}.`);
      } else {
        toast.success(`${email} added.`);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function removeInvitee(email: string) {
    if (email === clientEmail?.toLowerCase()) {
      toast.message("The client is always on the list. Change it via Edit contract.");
      return;
    }
    setSaving(true);
    try {
      const nextList = invitees.filter((e) => e.toLowerCase() !== email);
      const res = await authed(`/api/contracts/${contractId}/share`, {
        method: "POST",
        body: JSON.stringify({ invitee_emails: nextList }),
      });
      if (!res.ok) {
        toast.error("Couldn't remove.");
        return;
      }
      setInvitees(nextList);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function setVis(next: ContractVisibility) {
    if (next === visibility) return;
    setSaving(true);
    try {
      const res = await authed(`/api/contracts/${contractId}/share`, {
        method: "POST",
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't update access.");
        return;
      }
      setVisibility(next);
      toast.success(
        next === "public" ? "Anyone with the link can fund." : "Only invited people can fund.",
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <DialogTitle className="font-display text-display-sm tracking-tight">Share contract</DialogTitle>
          <DialogDescription className="mt-1 text-body-sm text-fg-muted">
            Anyone with the link can read it. Funding is gated by your sharing rules.
          </DialogDescription>
        </div>

        <div className="px-6 py-4 space-y-3 border-t border-border">
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Add people</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={pendingEmail}
              onChange={(e) => setPendingEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInvitee();
                }
              }}
              placeholder="alex@helix.co"
              className="flex-1 rounded border border-border bg-bg-elevated px-3 py-2 text-body-sm text-fg outline-none focus:border-accent placeholder:text-fg-subtle"
              disabled={saving}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={addInvitee}
              disabled={saving || !pendingEmail.trim()}
              leftIcon={
                saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />
              }
            >
              Add
            </Button>
          </div>
          <label className="flex items-center gap-2 text-body-sm text-fg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={sendOnAdd}
              onChange={(e) => setSendOnAdd(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent)]"
            />
            <span className="inline-flex items-center gap-1.5">
              <Send className="h-3 w-3" /> Email an invitation to them automatically
            </span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-border">
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-3">
            People with access
          </p>
          <ul className="space-y-1.5">
            {orderedInvitees.length === 0 ? (
              <li className="text-body-sm text-fg-subtle italic">
                No one added yet. Anyone with the link can fund (until you restrict access below).
              </li>
            ) : (
              orderedInvitees.map((email) => {
                const isClient = email === clientEmail?.toLowerCase();
                return (
                  <li
                    key={email}
                    className="flex items-center gap-3 rounded border border-border bg-bg-elevated px-3 py-2"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-body-sm text-fg truncate">{email}</span>
                      {isClient ? (
                        <span className="text-caption uppercase tracking-[0.14em] text-fg-subtle">
                          Client
                        </span>
                      ) : null}
                    </span>
                    {!isClient ? (
                      <button
                        type="button"
                        onClick={() => removeInvitee(email)}
                        disabled={saving}
                        className="text-fg-subtle hover:text-danger transition-colors disabled:opacity-40"
                        aria-label={`Remove ${email}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="px-6 py-4 border-t border-border space-y-3">
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">General access</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVis("public")}
              disabled={saving}
              className={cn(
                "rounded border px-3 py-3 text-left transition-colors duration-150",
                visibility === "public"
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-border-strong bg-bg",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-3.5 w-3.5 text-fg-muted" />
                <span className="text-body-sm text-fg">Anyone with the link</span>
                {visibility === "public" ? <Check className="h-3.5 w-3.5 text-accent ml-auto" /> : null}
              </div>
              <p className="text-caption text-fg-subtle leading-[1.5]">
                Whoever opens the link can fund.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setVis("restricted")}
              disabled={saving}
              className={cn(
                "rounded border px-3 py-3 text-left transition-colors duration-150",
                visibility === "restricted"
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-border-strong bg-bg",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-3.5 w-3.5 text-fg-muted" />
                <span className="text-body-sm text-fg">Restricted</span>
                {visibility === "restricted" ? (
                  <Check className="h-3.5 w-3.5 text-accent ml-auto" />
                ) : null}
              </div>
              <p className="text-caption text-fg-subtle leading-[1.5]">
                Only invited emails can fund.
              </p>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-2">
          <code className="flex-1 font-mono text-mono-sm text-fg truncate">{url}</code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded border border-border hover:border-border-strong px-3 py-1.5 text-body-sm text-fg transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="px-6 py-3 border-t border-border flex justify-end">
          <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
