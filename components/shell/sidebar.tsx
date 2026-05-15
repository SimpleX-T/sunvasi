"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FileText, LayoutDashboard, Settings, Stethoscope, User } from "lucide-react";
import { Wordmark } from "@/components/marketing/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { ThemeSwitcher } from "./theme-switcher";
import { SignOutButton } from "./sign-out-button";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: typeof FileText }[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/contracts", label: "Contracts", icon: FileText },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/profile", label: "Profile", icon: User },
];

interface SidebarProps {
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export function Sidebar({ email, displayName, avatarUrl }: SidebarProps) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-border bg-bg/60 backdrop-blur-sm sticky top-0 h-svh">
      <div className="px-5 pt-5 pb-3">
        <Wordmark size="sm" />
      </div>
      <div className="hairline mx-5 mt-2" />
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded px-3 py-2 text-body-sm transition-colors duration-150",
                active
                  ? "bg-bg-subtle text-fg"
                  : "text-fg-muted hover:text-fg hover:bg-bg-subtle",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-border space-y-0.5">
        <Link
          href="/app/diagnostics"
          className={cn(
            "flex items-center gap-2.5 rounded px-3 py-2 text-body-sm transition-colors duration-150",
            pathname.startsWith("/app/diagnostics")
              ? "bg-bg-subtle text-fg"
              : "text-fg-muted hover:text-fg hover:bg-bg-subtle",
          )}
        >
          <Stethoscope className="h-4 w-4" />
          <span>Diagnostics</span>
        </Link>
        <Link
          href="/app/settings"
          className={cn(
            "flex items-center gap-2.5 rounded px-3 py-2 text-body-sm transition-colors duration-150",
            pathname.startsWith("/app/settings")
              ? "bg-bg-subtle text-fg"
              : "text-fg-muted hover:text-fg hover:bg-bg-subtle",
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
      </div>

      <div className="border-t border-border px-3 py-3 flex items-center gap-3">
        <Avatar src={avatarUrl ?? undefined} name={displayName ?? email ?? "U"} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm text-fg">{displayName ?? email ?? "Signed in"}</p>
          {email && displayName ? (
            <p className="truncate text-caption uppercase tracking-[0.12em] text-fg-subtle font-mono">
              {email}
            </p>
          ) : null}
        </div>
      </div>
      <div className="border-t border-border px-3 py-3 flex items-center justify-between gap-2">
        <SignOutButton showLabel />
        <ThemeSwitcher />
      </div>
    </aside>
  );
}
