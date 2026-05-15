"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Link2, Loader2, Plus, Upload, Send, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthedFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { DeliverableFile, DeliverableLink } from "@/lib/supabase";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  milestoneId: string;
  milestoneTitle: string;
}

export function SubmitDeliverableDialog({
  open,
  onOpenChange,
  contractId,
  milestoneId,
  milestoneTitle,
}: Props) {
  const router = useRouter();
  const authed = useAuthedFetch();
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [links, setLinks] = useState<DeliverableLink[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(picked)) {
        if (file.size > 50_000_000) {
          toast.error(`${file.name} is over 50MB; skipped.`);
          continue;
        }
        const sigRes = await authed("/api/upload", {
          method: "POST",
          body: JSON.stringify({
            contract_id: contractId,
            milestone_id: milestoneId,
            filename: file.name,
            resource_type: file.type.startsWith("image/")
              ? "image"
              : file.type.startsWith("video/")
                ? "video"
                : "auto",
          }),
        });
        if (!sigRes.ok) {
          toast.error(`Couldn't sign upload for ${file.name}.`);
          continue;
        }
        const env = (await sigRes.json()) as {
          signature: string;
          timestamp: number;
          apiKey: string;
          cloudName: string;
          folder: string;
          publicId?: string;
          tags?: string;
          resourceType: "image" | "video" | "raw" | "auto";
        };
        const fd = new FormData();
        fd.append("file", file);
        fd.append("api_key", env.apiKey);
        fd.append("timestamp", String(env.timestamp));
        fd.append("signature", env.signature);
        fd.append("folder", env.folder);
        if (env.publicId) fd.append("public_id", env.publicId);
        if (env.tags) fd.append("tags", env.tags);
        const up = await fetch(
          `https://api.cloudinary.com/v1_1/${env.cloudName}/${env.resourceType}/upload`,
          { method: "POST", body: fd },
        );
        const upJson = (await up.json()) as {
          secure_url?: string;
          bytes?: number;
          format?: string;
          error?: { message: string };
        };
        if (!up.ok || !upJson.secure_url) {
          toast.error(
            upJson.error?.message ?? `Upload failed for ${file.name}.`,
          );
          continue;
        }
        setFiles((prev) => [
          ...prev,
          {
            cloudinary_url: upJson.secure_url!,
            type: file.type || upJson.format || "application/octet-stream",
            size: upJson.bytes ?? file.size,
            filename: file.name,
          },
        ]);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: "", url: "" }].slice(0, 10));
  }

  async function onSubmit() {
    if (files.length === 0 && links.length === 0 && note.trim().length === 0) {
      toast.error("Add at least a file, a link, or a note.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await authed(`/api/milestones/${milestoneId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          files,
          links: links.filter((l) => l.label.trim() && l.url.trim()),
          note: note.trim(),
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(payload.error ?? "Submission failed.");
        return;
      }
      toast.success("Milestone submitted. The client has been notified.");
      onOpenChange(false);
      setFiles([]);
      setLinks([]);
      setNote("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Submit deliverable</DialogTitle>
        <DialogDescription className="mt-1">
          For <span className="font-mono text-fg">{milestoneTitle}</span> — add
          files, links, and a short note. The client gets an emailed copy of
          what you submit.
        </DialogDescription>

        <div className="mt-6 space-y-6">
          {/* Files */}
          <section>
            <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-3">
              Files
            </p>
            {files.length > 0 ? (
              <ul className="mb-3 space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 rounded border border-border bg-bg px-3 py-2 text-body-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-fg-subtle shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-fg">
                      {f.filename}
                    </span>
                    <span className="font-mono text-mono-sm text-fg-subtle">
                      {(f.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFiles(files.filter((_, idx) => idx !== i))
                      }
                      className="text-fg-subtle hover:text-danger transition-colors"
                      aria-label={`Remove ${f.filename}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label
              className={cn(
                "inline-flex items-center gap-2 rounded border border-border hover:border-border-strong bg-bg px-3.5 py-2 text-body-sm text-fg cursor-pointer transition-colors duration-150",
                uploading && "opacity-60 cursor-not-allowed",
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>{uploading ? "Uploading…" : "Add files"}</span>
              <input
                type="file"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={onUpload}
              />
            </label>
            <p className="mt-2 text-body-sm text-fg-subtle">
              Up to 50MB per file. Images, video, PDF, zip.
            </p>
          </section>

          {/* Links */}
          <section>
            <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-3">
              Links
            </p>
            {links.length > 0 ? (
              <ul className="space-y-2">
                {links.map((l, i) => (
                  <li key={i} className="grid grid-cols-[140px_1fr_auto] gap-2">
                    <Input
                      placeholder="Label"
                      value={l.label}
                      onChange={(e) =>
                        setLinks(
                          links.map((x, idx) =>
                            idx === i ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Input
                      placeholder="https://"
                      value={l.url}
                      onChange={(e) =>
                        setLinks(
                          links.map((x, idx) =>
                            idx === i ? { ...x, url: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLinks(links.filter((_, idx) => idx !== i))
                      }
                      className="text-fg-subtle hover:text-danger transition-colors px-2"
                      aria-label="Remove link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={addLink}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              className="mt-2"
            >
              Add link
            </Button>
          </section>

          {/* Note */}
          <section>
            <Textarea
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the client should read alongside the deliverable…"
              rows={3}
            />
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting || uploading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={submitting || uploading}
            leftIcon={
              submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )
            }
          >
            Submit deliverable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
