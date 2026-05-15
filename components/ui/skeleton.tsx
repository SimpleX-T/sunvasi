import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shimmer rounded border border-border", className)}
      aria-busy
      aria-live="polite"
      {...rest}
    />
  );
}
