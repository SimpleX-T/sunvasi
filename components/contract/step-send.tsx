"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthedFetch } from "@/lib/api-client";

interface Props {
  shortId: string | null;
  contractId?: string | null;
  clientEmail?: string;
}

export function Step4Send({ shortId, contractId, clientEmail }: Props) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const authed = useAuthedFetch();

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  if (!shortId) {
    return (
      <div className="text-body-sm text-fg-muted">
        Something went wrong. Try going back and resubmitting.
      </div>
    );
  }
  const url = `${origin}/c/${shortId}`;
  const mailtoHref = `mailto:${encodeURIComponent(clientEmail ?? "")}?subject=${encodeURIComponent(
    "Contract for review on Sunvasi",
  )}&body=${encodeURIComponent(`I've put our project on Sunvasi. Funds held in escrow, released on approval:\n\n${url}\n`)}`;

  async function sendByServer() {
    if (!contractId) {
      toast.error("Couldn't find the contract id. Reload and try again.");
      return;
    }
    setSending(true);
    try {
      const res = await authed(`/api/contracts/${contractId}/send`, {
        method: "POST",
        body: JSON.stringify({ to: clientEmail }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mode?: string;
        message?: string;
      };
      if (res.ok && payload.ok) {
        setSentTo(clientEmail ?? null);
        toast.success(`Sent to ${clientEmail}.`);
      } else if (payload.mode === "unconfigured") {
        toast.message("Server email isn't configured. Opening your mail client instead.");
        window.location.href = mailtoHref;
      } else {
        toast.error(payload.message ?? "Couldn't send. Use Copy link instead.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <p className="eyebrow">Done</p>
        <h2 className="mt-3 font-display text-display-lg text-fg tracking-[-0.02em]">
          <Sparkles className="inline-block h-6 w-6 align-baseline text-accent mr-2" />
          Your contract is ready.
        </h2>
        <p className="mt-3 text-body text-fg-muted max-w-[55ch]">
          Send the link to your client. They&apos;ll review the contract, fund the
          escrow, and you&apos;re both off to the races.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-bg p-1 flex items-center">
        <code className="flex-1 px-4 py-3 font-mono text-mono text-fg truncate">{url}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url).catch(() => undefined);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="inline-flex items-center gap-1.5 mr-1 rounded bg-accent text-accent-fg hover:bg-accent-hover px-3 py-2 text-body-sm transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-bg-elevated p-5 space-y-3">
        <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Send to client</p>
        <p className="text-body-sm text-fg-muted">
          We&apos;ll email{" "}
          <code className="font-mono text-fg">{clientEmail || "(no address yet)"}</code> a
          rendered preview of the contract with a one-click funding button. If the server
          email service isn&apos;t configured, your mail client opens instead.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={sendByServer}
            disabled={!clientEmail || sending || Boolean(sentTo)}
            leftIcon={
              sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sentTo ? (
                <Check className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )
            }
          >
            {sentTo ? `Sent to ${sentTo}` : "Send invitation"}
          </Button>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 rounded border border-border hover:border-border-strong px-3 py-1.5 text-body-sm text-fg transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Open in mail client
          </a>
        </div>
      </div>

      <div className="hairline" />
      <div className="flex items-center justify-between">
        <Link href="/app" className="text-body-sm text-fg-muted hover:text-fg transition-colors">
          ← Back to dashboard
        </Link>
        <Button variant="primary" asChild>
          <Link href={`/app/contracts/${shortId}`}>View contract</Link>
        </Button>
      </div>
    </div>
  );
}
