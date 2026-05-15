"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, Copy, Check, Loader2, Save, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { SkillsPicker } from "@/components/skills-picker";
import { useAuthedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ProfileRole, ProfileRow } from "@/lib/supabase";

const ROLE_OPTIONS: Array<{ id: ProfileRole; label: string }> = [
  { id: "freelancer", label: "Freelancer" },
  { id: "client", label: "Client" },
  { id: "both", label: "Both" },
];

interface PortfolioLink {
  label: string;
  url: string;
}

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const router = useRouter();
  const authed = useAuthedFetch();

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [role, setRole] = useState<ProfileRole>(profile.role);
  const [skills, setSkills] = useState<string[]>(profile.skills ?? []);
  const [rate, setRate] = useState<string>(
    profile.hourly_rate_usdc ? String(profile.hourly_rate_usdc) : "",
  );
  const [country, setCountry] = useState(profile.country ?? "");
  const [links, setLinks] = useState<PortfolioLink[]>(profile.portfolio_links ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function addLink() {
    setLinks([...links, { label: "", url: "" }].slice(0, 10));
  }

  async function onAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      toast.error("Avatar must be under 5MB.");
      return;
    }
    setUploading(true);
    try {
      // For profile avatars we sign uploads in a dedicated folder.
      const sigRes = await authed("/api/upload/avatar", {
        method: "POST",
        body: JSON.stringify({ filename: file.name }),
      });
      if (!sigRes.ok) throw new Error(await sigRes.text());
      const env = (await sigRes.json()) as {
        signature: string;
        timestamp: number;
        apiKey: string;
        cloudName: string;
        folder: string;
        publicId?: string;
        tags?: string;
      };
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", env.apiKey);
      fd.append("timestamp", String(env.timestamp));
      fd.append("signature", env.signature);
      fd.append("folder", env.folder);
      if (env.publicId) fd.append("public_id", env.publicId);
      // Tags are part of the signed string when present — must be forwarded
      // verbatim or Cloudinary rejects the signature.
      if (env.tags) fd.append("tags", env.tags);
      const up = await fetch(
        `https://api.cloudinary.com/v1_1/${env.cloudName}/auto/upload`,
        { method: "POST", body: fd },
      );
      const upJson = (await up.json()) as { secure_url?: string; error?: { message: string } };
      if (!up.ok || !upJson.secure_url) {
        throw new Error(upJson.error?.message ?? "Upload failed");
      }
      setAvatarUrl(upJson.secure_url);
      toast.success("Avatar updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await authed("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName.trim() || undefined,
          bio: bio.trim() || null,
          role,
          skills,
          hourly_rate_usdc: rate ? Number(rate) : null,
          country: country.trim() || null,
          portfolio_links: links.filter((l) => l.label.trim() && l.url.trim()),
          avatar_url: avatarUrl ?? null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Profile saved.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-12">
      <section className="flex items-center gap-6">
        <Avatar src={avatarUrl ?? undefined} name={displayName || profile.email} size={72} />
        <div>
          <label
            className={cn(
              "inline-flex items-center gap-2 rounded border border-border hover:border-border-strong px-3.5 py-2 text-body-sm text-fg cursor-pointer transition-colors duration-150",
              uploading && "opacity-60 cursor-not-allowed",
            )}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            <span>Change avatar</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={onAvatarUpload}
            />
          </label>
          <p className="mt-2 text-body-sm text-fg-subtle">PNG, JPG, GIF up to 5MB.</p>
        </div>
      </section>

      <Section label="Role">
        <div className="flex items-center gap-2">
          {ROLE_OPTIONS.map((r) => {
            const active = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={cn(
                  "rounded border px-4 py-2 text-body-sm transition-colors duration-150",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-fg-muted hover:border-border-strong",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Display name">
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Section>

      <Section label="Bio">
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          placeholder="A line or two. What do you do, and for whom?"
        />
      </Section>

      <Section label="Skills">
        <SkillsPicker value={skills} onChange={setSkills} max={20} catalogMaxHeight="320px" />
      </Section>

      <div className="grid sm:grid-cols-2 gap-8">
        <Section label="Hourly rate (USDC)">
          <Input
            mono
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="65"
            leadingIcon={<span className="font-mono text-mono-sm">$</span>}
          />
        </Section>
        <Section label="Country">
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="NG"
          />
        </Section>
      </div>

      <Section label="Portfolio links">
        <ul className="space-y-2">
          {links.map((l, i) => (
            <li key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input
                placeholder="Label"
                value={l.label}
                onChange={(e) =>
                  setLinks(links.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <Input
                placeholder="https://"
                value={l.url}
                onChange={(e) =>
                  setLinks(links.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))
                }
              />
              <button
                type="button"
                onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                className="text-fg-subtle hover:text-danger transition-colors px-2"
                aria-label="Remove link"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <Button variant="ghost" onClick={addLink} className="mt-2">
          Add link
        </Button>
      </Section>

      <Section label="Stellar wallet">
        {profile.payout_address ? (
          <WalletPanel address={profile.payout_address} />
        ) : (
          <p className="text-body-sm text-fg-subtle italic">
            Your Stellar wallet will be provisioned automatically on next sign-in.
          </p>
        )}
      </Section>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 bg-bg-elevated/95 backdrop-blur-md border border-border rounded-lg px-4 py-3">
        <Button
          variant="primary"
          onClick={save}
          disabled={busy}
          leftIcon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        >
          Save profile
        </Button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-3">{label}</p>
      {children}
    </section>
  );
}

function WalletPanel({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const network =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
  const explorerUrl = `https://stellar.expert/explorer/${network}/account/${address}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded border border-border bg-bg p-3">
        <code className="flex-1 min-w-0 font-mono text-mono-sm text-fg break-all">
          {address}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(address).catch(() => undefined);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
          className="inline-flex items-center gap-1.5 rounded border border-border hover:border-border-strong px-2.5 py-1.5 text-caption uppercase tracking-[0.14em] text-fg-muted hover:text-fg transition-colors"
          aria-label="Copy wallet address"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-body-sm text-fg-muted">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-fg transition-colors"
        >
          View on Stellar Expert
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="text-body-sm text-fg-subtle leading-[1.55] max-w-[60ch]">
        USDC released from approved milestones lands here. Off-ramp to Naira via Yellow
        Card, Onboard, or Busha. Sunvasi manages this wallet for you on testnet — full
        self-custody (export to Freighter or another Stellar wallet) is coming next.
      </p>
    </div>
  );
}
