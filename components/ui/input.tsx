"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  mono?: boolean;
  display?: boolean;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, inputClassName, id, label, hint, error, leadingIcon, trailingIcon, mono, display, ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
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
          "flex items-center rounded border border-border bg-bg-elevated transition-colors duration-150 ease-sunvasi",
          "focus-within:border-accent",
          error && "border-danger focus-within:border-danger",
        )}
      >
        {leadingIcon ? (
          <span className="pl-3 text-fg-subtle flex items-center">{leadingIcon}</span>
        ) : null}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "flex-1 bg-transparent px-3 py-2.5 text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed",
            mono && "font-mono",
            display && "font-display text-display-sm",
            inputClassName,
          )}
          {...rest}
        />
        {trailingIcon ? (
          <span className="pr-3 text-fg-subtle flex items-center">{trailingIcon}</span>
        ) : null}
      </div>
      {error ? (
        <p className="text-body-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-body-sm text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
});
