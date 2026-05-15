"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = RadixTooltip.Provider;
export const TooltipRoot = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export const TooltipContent = forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded border border-border bg-bg-elevated px-2.5 py-1.5 text-body-sm text-fg shadow-popover",
          "data-[state=delayed-open]:animate-fade-in",
          className,
        )}
        {...rest}
      />
    </RadixTooltip.Portal>
  );
});

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
