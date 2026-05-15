import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "elevated" | "ghost";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

const variants: Record<CardVariant, string> = {
  default: "bg-bg-elevated border border-border",
  elevated: "bg-bg-elevated border border-border shadow-popover",
  ghost: "bg-transparent border border-border",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "default", interactive, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg transition-colors duration-150 ease-sunvasi",
        variants[variant],
        interactive && "hover:border-border-strong cursor-pointer",
        className,
      )}
      {...rest}
    />
  );
});

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-3 flex flex-col gap-1.5", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("font-display text-display-sm tracking-tight text-fg", className)}
      {...rest}
    />
  );
}

export function CardDescription({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-body-sm text-fg-muted", className)} {...rest} />;
}

export function CardContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-3", className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("p-6 pt-3 flex items-center gap-2 border-t border-border", className)}
      {...rest}
    />
  );
}
