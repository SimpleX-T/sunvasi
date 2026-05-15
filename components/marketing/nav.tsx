"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { Wordmark } from "./wordmark";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

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
          {PRIVY_CONFIGURED ? <AuthAwareActions /> : <DefaultActions />}
        </div>
      </nav>
    </header>
  );
}

function DefaultActions() {
  return (
    <>
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
    </>
  );
}

function AuthAwareActions() {
  const privy = usePrivy();

  // Until Privy hydrates, render nothing on the right side. Prevents the
  // "Sign in" button flashing in for a beat when the user is already authed.
  if (!privy.ready) {
    return <span className="h-7 w-32" aria-hidden />;
  }

  if (privy.authenticated) {
    const displayName =
      privy.user?.email?.address ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((privy.user as any)?.google?.email as string | undefined) ??
      "Signed in";
    return (
      <Link
        href="/app"
        className="inline-flex items-center gap-2 rounded border border-border hover:border-border-strong bg-bg-elevated px-3 py-1.5 text-body-sm text-fg transition-colors duration-150 ease-sunvasi"
      >
        <Avatar name={displayName} size={20} className="bg-accent/15 text-accent" />
        <span>Open app</span>
        <LayoutDashboard className="h-3.5 w-3.5 text-fg-muted" />
      </Link>
    );
  }

  return <DefaultActions />;
}
