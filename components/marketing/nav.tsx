"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Wordmark } from "./wordmark";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/arbitration", label: "Arbitration" },
];

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/70 border-b border-border">
      <nav className="mx-auto flex items-center justify-between max-w-[1280px] px-6 py-4 lg:px-10">
        <Wordmark />
        <div className="hidden md:flex items-center gap-8">
          {ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-body-sm transition-colors duration-150",
                  active ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden md:inline-flex items-center text-body-sm text-fg-muted hover:text-fg transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/sign-in?intent=create"
            className="inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:bg-accent-hover rounded px-3.5 py-1.5 text-body-sm font-medium transition-colors duration-150 ease-sunvasi"
          >
            Create a contract
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
