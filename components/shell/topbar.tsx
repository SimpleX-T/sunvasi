"use client";

import { Command, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Topbar({ label, children }: { label: string; children?: ReactNode }) {
  const [, setPaletteOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-bg/70 backdrop-blur-md px-6 lg:px-10 py-3.5">
      <div className="flex items-center gap-2 font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.16em]">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "hidden md:inline-flex items-center gap-2 rounded border border-border bg-bg-elevated px-3 py-1.5",
            "text-body-sm text-fg-muted hover:text-fg hover:border-border-strong transition-colors duration-150",
          )}
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
          <span className="ml-2 flex items-center gap-0.5 font-mono text-mono-sm text-fg-subtle">
            <Command className="h-3 w-3" />K
          </span>
        </button>
      </div>
    </header>
  );
}
