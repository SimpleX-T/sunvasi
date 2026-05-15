"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, label, hint, error, rows = 4, ...rest },
  ref,
) {
  const reactId = useId();
  const tid = id ?? `textarea-${reactId}`;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={tid} className="text-caption uppercase tracking-[0.16em] text-fg-muted">
          {label}
        </label>
      ) : null}
      <textarea
        id={tid}
        ref={ref}
        rows={rows}
        className={cn(
          "rounded border border-border bg-bg-elevated px-3 py-2.5 text-fg outline-none transition-colors duration-150 ease-sunvasi",
          "focus:border-accent placeholder:text-fg-subtle resize-y min-h-24",
          error && "border-danger focus:border-danger",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="text-body-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-body-sm text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
});
