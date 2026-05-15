"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "./share-dialog";
import { useAuthedFetch } from "@/lib/api-client";
import type { ContractVisibility } from "@/lib/supabase";

interface Props {
  contractId: string;
  shortId: string;
  status: string;
  clientEmail: string | null;
  visibility: ContractVisibility;
  inviteeEmails: string[];
}

const MUTABLE = new Set(["draft", "awaiting_funding"]);

export function ContractActions({
  contractId,
  shortId,
  status,
  clientEmail,
  visibility,
  inviteeEmails,
}: Props) {
  const router = useRouter();
  const authed = useAuthedFetch();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutable = MUTABLE.has(status);

  async function onDelete() {
    setBusy(true);
    try {
      const res = await authed(`/api/contracts/${contractId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast.error(payload.message ?? "Couldn't delete.");
        return;
      }
      toast.success("Contract deleted.");
      setDeleteOpen(false);
      router.push("/app/contracts");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShareOpen(true)}
          leftIcon={<Share2 className="h-3.5 w-3.5" />}
        >
          Share
        </Button>
        {mutable ? (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link
                href={`/app/contracts/${shortId}/edit`}
                className="inline-flex items-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="text-fg-muted hover:text-danger hover:border-danger"
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </span>
            </Button>
          </>
        ) : (
          <span className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.14em]">
            Funded — edits locked
          </span>
        )}
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        contractId={contractId}
        shortId={shortId}
        clientEmail={clientEmail}
        initialVisibility={visibility}
        initialInvitees={inviteeEmails}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete this contract?</DialogTitle>
          <DialogDescription className="mt-2">
            This wipes the draft, its milestones, and any activity. The funding
            link (/c/{shortId}) will return a 404. The client hasn&apos;t funded
            anything yet, so no money is at risk.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onDelete}
              disabled={busy}
              leftIcon={
                busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )
              }
            >
              Delete contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
