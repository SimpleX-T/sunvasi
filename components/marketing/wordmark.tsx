import Link from "next/link";
import { cn } from "@/lib/utils";

export interface WordmarkProps {
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

export function Wordmark({ className, href = "/", size = "md" }: WordmarkProps) {
  const inner = (
    <span
      className={cn(
        "font-display tracking-tight text-fg leading-none",
        sizes[size],
        className,
      )}
      style={{ fontVariationSettings: '"opsz" 144, "wght" 500' }}
    >
      <span className="italic font-light">S</span>unvasi
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="Sunvasi home" className="inline-block no-tap">
      {inner}
    </Link>
  );
}
