"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-medium select-none whitespace-nowrap rounded transition-colors duration-150 ease-sunvasi active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none no-tap focus-visible:outline-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover border border-accent hover:border-accent-hover",
  secondary:
    "bg-bg-elevated text-fg border border-border hover:border-border-strong hover:bg-bg-subtle",
  ghost:
    "bg-transparent text-fg border border-transparent hover:bg-bg-subtle hover:border-border",
  danger:
    "bg-transparent text-danger border border-border hover:bg-bg-subtle hover:border-danger",
  link:
    "bg-transparent text-accent underline-offset-4 hover:underline px-0 py-0 h-auto rounded-none",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-body-sm",
  md: "h-10 px-4 text-body-sm",
  lg: "h-12 px-6 text-body",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "secondary",
    size = "md",
    asChild,
    loading,
    leftIcon,
    rightIcon,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const classes = cn(base, sizes[size], variants[variant], className);

  // When `asChild` is true Radix's Slot requires exactly one child element.
  // The consumer composes their own inner layout (e.g. <Link>…</Link>), so we
  // skip the icon/loader/span wrappers entirely and just pass styling through.
  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={classes}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(rest as any)}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
      ) : leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
