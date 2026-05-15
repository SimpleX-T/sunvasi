import { Suspense } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/marketing/wordmark";
import { SignInPanel } from "./sign-in-panel";

const QUOTES = [
  {
    text: "Last month, I waited 18 days for a wire from Berlin. The Naira had moved 6%.",
    cite: "Anonymous Lagos developer, March 2026",
  },
  {
    text: "We pay our contractors in three corridors. Sunvasi made the Lagos one the easiest of the three.",
    cite: "David, Berlin",
  },
  {
    text: "The first contract that closed before the freelancer had to follow up.",
    cite: "Amara, Lagos",
  },
];

export default function SignInPage() {
  return (
    <div className="grid min-h-svh w-full lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 lg:px-12">
        <Wordmark />
        <div className="flex flex-1 items-center justify-center">
          <Suspense fallback={null}>
            <SignInPanel />
          </Suspense>
        </div>
        <div className="text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
          <Link href="/" className="hover:text-fg transition-colors">
            ← Back to Sunvasi
          </Link>
        </div>
      </div>

      <div className="hidden lg:flex relative items-center justify-center border-l border-border bg-bg-elevated">
        <div className="max-w-md px-12 py-16">
          <blockquote className="font-display text-display-md text-fg leading-[1.2] tracking-[-0.015em]">
            &ldquo;{QUOTES[0]!.text}&rdquo;
          </blockquote>
          <cite className="not-italic block mt-6 text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
            — {QUOTES[0]!.cite}
          </cite>
        </div>
        <div className="absolute bottom-8 left-12 text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
          01 / 03
        </div>
      </div>
    </div>
  );
}
