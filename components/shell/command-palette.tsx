"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Activity,
  FileText,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();
  const privy = PRIVY_CONFIGURED ? usePrivy() : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl rounded-lg border border-border bg-bg-elevated shadow-modal overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <Command className="font-sans" label="Command Menu">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search className="h-4 w-4 text-fg-subtle" />
                <Command.Input
                  placeholder="Search or jump to…"
                  className="flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
                  autoFocus
                />
                <span className="font-mono text-mono-sm text-fg-subtle">ESC</span>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-body-sm text-fg-subtle text-center">
                  No matches.
                </Command.Empty>

                <Group heading="Navigate">
                  <Item onSelect={() => go("/app")} icon={LayoutDashboard} label="Dashboard" />
                  <Item onSelect={() => go("/app/contracts")} icon={FileText} label="Contracts" />
                  <Item onSelect={() => go("/app/activity")} icon={Activity} label="Activity" />
                  <Item onSelect={() => go("/app/profile")} icon={User} label="Profile" />
                  <Item onSelect={() => go("/app/settings")} icon={Settings} label="Settings" />
                </Group>

                <Group heading="Actions">
                  <Item
                    onSelect={() => go("/app/contracts/new")}
                    icon={Plus}
                    label="Create new contract"
                    accent
                  />
                </Group>

                <Group heading="Theme">
                  <Item
                    onSelect={() => {
                      setTheme("dark");
                      setOpen(false);
                    }}
                    icon={Moon}
                    label="Dark theme"
                  />
                  <Item
                    onSelect={() => {
                      setTheme("light");
                      setOpen(false);
                    }}
                    icon={Sun}
                    label="Light theme"
                  />
                </Group>

                <Group heading="Account">
                  <Item onSelect={() => go("/app/profile")} icon={User} label="Edit profile" />
                  <Item
                    onSelect={async () => {
                      try {
                        await privy?.logout?.();
                      } catch {
                        // ignore
                      }
                      await fetch("/api/sign-out", { method: "POST" }).catch(() => undefined);
                      setOpen(false);
                      router.push("/");
                      router.refresh();
                    }}
                    icon={LogOut}
                    label="Sign out"
                  />
                </Group>
              </Command.List>
            </Command>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="text-caption uppercase tracking-[0.16em] text-fg-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-fg-subtle"
    >
      {children}
    </Command.Group>
  );
}

function Item({
  onSelect,
  icon: Icon,
  label,
  accent,
}: {
  onSelect: () => void;
  icon: typeof FileText;
  label: string;
  accent?: boolean;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded text-body-sm cursor-pointer transition-colors",
        "data-[selected=true]:bg-bg-subtle data-[selected=true]:text-fg",
        accent ? "text-accent" : "text-fg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Command.Item>
  );
}
