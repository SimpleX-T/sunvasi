"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EscrowDiagram } from "./escrow-diagram";

const LINES = [["Contracts"], ["that", "pay"], ["themselves."]];

export function Hero() {
  let wordIndex = 0;
  return (
    <section className="relative pt-12 lg:pt-20 pb-24 lg:pb-32">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="eyebrow"
            >
              01 — Escrow for independent work
            </motion.p>

            <h1 className="mt-6 font-display text-display-2xl text-fg leading-[0.96] tracking-[-0.025em]">
              {LINES.map((line, li) => (
                <span key={li} className="block">
                  {line.map((word, wi) => {
                    const i = wordIndex++;
                    return (
                      <motion.span
                        key={wi}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.5,
                          delay: 0.1 + i * 0.06,
                          ease: [0.32, 0.72, 0, 1],
                        }}
                        className="inline-block mr-3 last:mr-0"
                      >
                        {word}
                      </motion.span>
                    );
                  })}
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="mt-8 text-body-lg text-fg-muted max-w-[60ch] leading-[1.55]"
            >
              Sunvasi is a milestone-based escrow platform for cross-border freelance work.
              Funds are held in USDC, released by agreement, and arbitrated by an AI when you
              don&apos;t agree.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/sign-in?intent=create"
                className="inline-flex items-center gap-2 bg-accent text-accent-fg hover:bg-accent-hover rounded px-5 py-3 text-body-sm font-medium transition-colors duration-150 ease-sunvasi active:scale-[0.99]"
              >
                Create a contract
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 border border-border hover:border-border-strong rounded px-5 py-3 text-body-sm font-medium text-fg transition-colors duration-150 ease-sunvasi"
              >
                How it works
              </Link>
              <Link
                href="/app/contracts/DEMOH3LX/arbitration"
                className="inline-flex items-center gap-2 text-body-sm text-fg-muted hover:text-fg transition-colors duration-150 ease-sunvasi underline-offset-4 hover:underline px-2"
              >
                Try the demo →
              </Link>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.85, ease: [0.32, 0.72, 0, 1] }}
              className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-mono-sm text-fg-subtle"
            >
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" />
                0% platform fee during beta
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" />
                USDC on Stellar
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" />
                60-second AI arbitration
              </li>
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: [0.32, 0.72, 0, 1] }}
            className="hidden lg:block"
          >
            <EscrowDiagram />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
