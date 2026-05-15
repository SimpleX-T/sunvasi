"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepDef {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepDef[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "flex items-center gap-3 lg:gap-5 font-mono text-mono-sm text-fg-muted",
        className,
      )}
      aria-label="Progress"
    >
      {steps.map((step, idx) => {
        const active = idx === current;
        const done = idx < current;
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-full border text-mono-sm transition-colors",
                done
                  ? "border-accent bg-accent text-accent-fg"
                  : active
                    ? "border-accent text-accent"
                    : "border-border text-fg-subtle",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : <span className="text-mono-sm">{idx + 1}</span>}
            </span>
            <span
              className={cn(
                "uppercase tracking-[0.16em]",
                active ? "text-fg" : done ? "text-fg-muted" : "text-fg-subtle",
              )}
            >
              {step.label}
            </span>
            {idx < steps.length - 1 ? (
              <span
                className={cn(
                  "ml-1 hidden lg:inline-block h-px w-12",
                  done ? "bg-accent" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
