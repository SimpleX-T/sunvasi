"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogPortal = RadixDialog.Portal;
export const DialogClose = RadixDialog.Close;

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(function DialogOverlay({ className, ...rest }, ref) {
  return (
    <RadixDialog.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/55 backdrop-blur-sm",
        "data-[state=open]:animate-fade-in-slow data-[state=closed]:opacity-0",
        className,
      )}
      {...rest}
    />
  );
});

export const DialogContent = forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & { hideClose?: boolean }
>(function DialogContent({ className, children, hideClose, ...rest }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <RadixDialog.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100vw-2rem)] max-w-lg",
          "max-h-[calc(100svh-2rem)] overflow-y-auto",
          "rounded-lg border border-border bg-bg-elevated shadow-modal",
          "p-6 outline-none",
          "data-[state=open]:animate-dialog-in",
          className,
        )}
        {...rest}
      >
        {children}
        {!hideClose ? (
          <RadixDialog.Close
            className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:bg-bg-subtle hover:text-fg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        ) : null}
      </RadixDialog.Content>
    </DialogPortal>
  );
});

export function DialogHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 mb-4", className)} {...rest} />;
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Title
      className={cn("font-display text-display-sm text-fg tracking-tight", className)}
    >
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Description className={cn("text-body-sm text-fg-muted", className)}>
      {children}
    </RadixDialog.Description>
  );
}

export function DialogFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex items-center justify-end gap-2", className)}
      {...rest}
    />
  );
}
