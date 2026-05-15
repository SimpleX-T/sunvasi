"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn, formatUsdc } from "@/lib/utils";

export interface AmountInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  showUsdEquivalent?: boolean;
  symbol?: "USDC" | "USD";
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  {
    className,
    id,
    label,
    hint,
    error,
    showUsdEquivalent = true,
    symbol = "USDC",
    value,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? `amount-${reactId}`;
  const numeric = typeof value === "number" ? value : Number(value ?? 0);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-caption uppercase tracking-[0.16em] text-fg-muted"
        >
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          "flex items-baseline gap-3 rounded border border-border bg-bg-elevated px-4 py-3 transition-colors duration-150 ease-sunvasi",
          "focus-within:border-accent",
          error && "border-danger focus-within:border-danger",
        )}
      >
        <span className="font-mono text-mono text-fg-subtle">$</span>
        <input
          id={inputId}
          ref={ref}
          inputMode="decimal"
          type="text"
          value={value ?? ""}
          className="flex-1 bg-transparent font-mono text-display-md tabular-nums text-fg outline-none placeholder:text-fg-subtle min-w-0"
          placeholder="0.00"
          {...rest}
        />
        <span className="text-caption uppercase tracking-[0.16em] text-fg-subtle">{symbol}</span>
      </div>
      {showUsdEquivalent && Number.isFinite(numeric) && numeric > 0 ? (
        <p className="text-body-sm text-fg-subtle font-mono">
          ≈ ${formatUsdc(numeric)} USD
        </p>
      ) : error ? (
        <p className="text-body-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-body-sm text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
});
