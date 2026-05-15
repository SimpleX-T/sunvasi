"use client";

import * as RadixAvatar from "@radix-ui/react-avatar";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  name?: string | null;
  size?: number;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]![0] ?? "?").toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { className, src, name, size = 32, style, ...rest },
  ref,
) {
  return (
    <RadixAvatar.Root
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full overflow-hidden border border-border bg-accent/15 text-accent font-medium select-none",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)), ...style }}
      {...rest}
    >
      {src ? <RadixAvatar.Image src={src} alt={name ?? "avatar"} className="h-full w-full object-cover" /> : null}
      <RadixAvatar.Fallback delayMs={src ? 400 : 0} className="font-sans">
        {initials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
});
