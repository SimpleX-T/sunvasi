"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { EscrowDiagram } from "@/components/marketing/escrow-diagram";
import { cn, formatUsdc } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Sunvasi product showcase — a 5-slide deck shaped for a live talk.
 *
 *   Each slide owns ~ten to twenty-five seconds of stage time. The deck is
 *   keyboard-driven (← / → / space) so the presenter never has to break eye
 *   contact with the audience to navigate. An "Open this page" CTA on every
 *   slide jumps into the live app at exactly the right moment.
 *
 *   The five chosen slides are the load-bearing beats from the longer
 *   script: hero, contract creation, client funding, the AI money shot, and
 *   on-chain settlement. The other beats (problem section, final return to
 *   hero) live in the voiceover.
 * ------------------------------------------------------------------------ */

interface Slide {
  ts: string;
  durationMs: number;
  eyebrow: string;
  title: React.ReactNode;
  body: React.ReactNode;
  cta: { label: string; href: string };
  visual: React.ReactNode;
}

function HeroVisual() {
  return (
    <div className="w-full">
      <EscrowDiagram />
      <div className="mt-8 flex flex-wrap gap-3 font-mono text-mono-sm text-fg-subtle">
        <span className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5">
          <span className="h-1 w-1 rounded-full bg-accent" />
          0% platform fee · beta
        </span>
        <span className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5">
          <span className="h-1 w-1 rounded-full bg-accent" />
          USDC on Stellar
        </span>
        <span className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5">
          <span className="h-1 w-1 rounded-full bg-accent" />
          60-second AI arbitration
        </span>
      </div>
    </div>
  );
}

function StepperVisual() {
  const steps = [
    { n: "01", title: "Basics", note: "Title, description, client, budget" },
    { n: "02", title: "Milestones", note: "Drag, reorder, set acceptance criteria" },
    { n: "03", title: "Review", note: "See it the way the client will" },
    { n: "04", title: "Send", note: "Copy link or fire an email" },
  ];
  return (
    <div className="w-full rounded-lg border border-border bg-bg-elevated p-8">
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="grid grid-cols-[64px_1fr] gap-4 items-center"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-accent/5 text-accent font-mono text-mono-lg">
              {s.n}
            </span>
            <div>
              <p className="font-display text-display-sm text-fg tracking-tight">
                {s.title}
              </p>
              <p className="text-body-sm text-fg-muted">{s.note}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function FundingPageVisual() {
  return (
    <article className="w-full rounded-lg border border-border bg-bg-elevated p-8">
      <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
        Sunvasi · Escrow agreement
      </p>
      <h3 className="mt-3 font-display text-display-md text-fg tracking-[-0.02em] leading-[1.05]">
        Marketing site redesign for Helix Software
      </h3>
      <p className="mt-3 text-body text-fg-muted">
        Between <span className="text-fg">you</span> and a freelancer
      </p>

      <div className="hairline my-6" />

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
            Total
          </p>
          <p className="mt-1 font-mono text-display-sm text-fg tabular-nums">
            ${formatUsdc(2000)}{" "}
            <span className="text-fg-subtle text-body">USDC</span>
          </p>
        </div>
        <div>
          <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
            Milestones
          </p>
          <p className="mt-1 font-display text-display-sm text-fg">3</p>
        </div>
      </div>

      <motion.button
        type="button"
        initial={{ scale: 0.99, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded bg-accent text-accent-fg px-5 py-4 text-body font-medium"
      >
        <Wallet className="h-4 w-4" />
        Fund this contract — $2,000.00
      </motion.button>

      <p className="mt-4 text-center text-body-sm text-fg-subtle">
        <ShieldCheck className="inline-block h-3.5 w-3.5 mr-1 -mt-0.5" />
        Non-custodial · held on Stellar via Trustless Work
      </p>
    </article>
  );
}

function ArbitrationVisual() {
  // A static cinematic of the live arbitration UI — tool calls, streaming
  // reasoning, verdict drop. Tuned to feel like the real thing in a glance.
  const toolCalls = [
    { name: "Reading the contract", tag: "Contract: Marketing site redesign" },
    { name: "Reviewing milestone history", tag: "2 of 3 milestones approved" },
    { name: "Reading evidence", tag: "Party · client" },
    { name: "Reading evidence", tag: "Party · freelancer" },
    { name: "Inspecting deliverables", tag: "2 link(s) submitted" },
    { name: "Composing verdict", tag: "Release 75% · split · medium" },
  ];
  return (
    <div className="w-full grid lg:grid-cols-[1.3fr_0.9fr] gap-5">
      <div className="rounded-lg border border-border bg-bg-elevated p-5">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">
            Tool-call timeline
          </p>
          <span className="inline-flex items-center gap-1.5 font-mono text-mono-sm text-accent">
            <Loader2 className="h-3 w-3 animate-spin" />
            live
          </span>
        </div>
        <ol className="space-y-2">
          {toolCalls.map((t, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.25, duration: 0.4 }}
              className="rounded border border-border bg-bg px-3 py-2 flex items-center gap-3"
            >
              <span className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-subtle">
                {i === toolCalls.length - 1 ? (
                  <Gavel className="h-3 w-3 text-accent" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-fg truncate">{t.name}</p>
                <p className="font-mono text-mono-sm text-fg-subtle truncate">
                  {t.tag}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border border-border bg-bg-elevated p-5 flex flex-col">
        <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">
          Reasoning
        </p>
        <div className="mt-3 flex-1 rounded border border-border bg-bg p-4 font-mono text-mono-sm text-fg leading-[1.7]">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            Two of four acceptance criteria are met cleanly. Lighthouse 87 is
            within run-to-run noise of the 90 target.
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
          >
            {" "}
            Domain swap requires client-side DNS access. Freelancer
            demonstrated good-faith delivery; 75% release plus 25% refund
            covers the remaining work…
          </motion.span>
          <span className="inline-block w-2 h-4 ml-0.5 align-text-bottom bg-accent animate-caret-blink" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.5 }}
          className="mt-4 rounded border border-accent/40 bg-accent/5 p-4"
        >
          <p className="font-mono text-mono-sm text-accent uppercase tracking-[0.14em]">
            Verdict · medium confidence
          </p>
          <p className="mt-2 font-display text-display-sm text-fg tracking-tight">
            Release <span className="text-accent">75%</span> to the freelancer
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function SettlementVisual() {
  return (
    <div className="w-full rounded-lg border border-border bg-bg-elevated p-8">
      <div className="flex items-baseline justify-between mb-6">
        <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
          Trustless Work · Escrow Viewer
        </p>
        <span className="inline-flex items-center gap-1.5 rounded border border-success/40 bg-success/5 text-success px-2 py-1 text-caption uppercase tracking-[0.14em]">
          <CheckCircle2 className="h-3 w-3" />
          Resolved
        </span>
      </div>
      <p className="font-mono text-mono-sm text-fg-subtle">Contract ID</p>
      <p className="mt-1 font-mono text-mono break-all text-fg">
        CC3VPB54NJ25KUFDLAULK7FGEZIOENMQYOBCEGUWO32ZA5YEGHDCG7VP
      </p>

      <div className="hairline my-6" />

      <ul className="space-y-3 font-mono text-mono-sm">
        <li className="flex items-center justify-between">
          <span className="text-fg-muted">Funded</span>
          <span className="text-fg tabular-nums">$2,000.00 USDC</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-fg-muted">Released to freelancer</span>
          <span className="text-fg tabular-nums">$2,300.00 USDC</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-fg-muted">Refunded to client</span>
          <span className="text-fg tabular-nums">$200.00 USDC</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="text-fg-muted">Arbitrator verdict</span>
          <span className="text-accent">75% / 25%</span>
        </li>
      </ul>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    ts: "0:00",
    durationMs: 6_000,
    eyebrow: "01 — Sunvasi",
    title: (
      <>
        Contracts <span className="text-fg-muted">that pay</span> themselves.
      </>
    ),
    body: (
      <p>
        A milestone-based escrow for cross-border freelance work. Funds held
        in USDC, released by agreement, arbitrated by AI when you don&apos;t agree.
      </p>
    ),
    cta: { label: "Open landing", href: "/" },
    visual: <HeroVisual />,
  },
  {
    ts: "0:15",
    durationMs: 12_000,
    eyebrow: "02 — The contract",
    title: (
      <>
        Compose it like an agreement,{" "}
        <span className="text-fg-muted">not a form.</span>
      </>
    ),
    body: (
      <p>
        Four steps. Title, milestones with acceptance criteria, a typeset
        review, then a single link to send. No platform fee, no haggling, no
        15% Upwork tax.
      </p>
    ),
    cta: { label: "Open contract creation", href: "/app/contracts/new" },
    visual: <StepperVisual />,
  },
  {
    ts: "0:30",
    durationMs: 12_000,
    eyebrow: "03 — The funding",
    title: (
      <>
        Client funds in <span className="text-accent">one click.</span>
      </>
    ),
    body: (
      <p>
        Email auth (no wallet UX, ever). Stellar settles in five seconds.
        Funds sit in a non-custodial escrow contract until the client
        approves — or the AI arbitrates on their behalf.
      </p>
    ),
    cta: { label: "Open funding page", href: "/c/DEMOH3LX" },
    visual: <FundingPageVisual />,
  },
  {
    ts: "0:45",
    durationMs: 25_000,
    eyebrow: "04 — The money shot",
    title: (
      <>
        Watch an AI arbitrate <span className="text-fg-muted">in 60 seconds.</span>
      </>
    ),
    body: (
      <p>
        When the client and freelancer disagree, the Sunvasi Arbitrator reads
        the contract, the evidence, the deliverables. Its tool calls are
        public. Its rules are public. Verdict streams in real time.
      </p>
    ),
    cta: {
      label: "Open arbitration",
      href: "/app/contracts/DEMOH3LX/arbitration",
    },
    visual: <ArbitrationVisual />,
  },
  {
    ts: "1:10",
    durationMs: 12_000,
    eyebrow: "05 — On-chain settlement",
    title: (
      <>
        And the funds <span className="text-accent">actually move.</span>
      </>
    ),
    body: (
      <p>
        Every verdict is signed and broadcast to Stellar via Trustless Work.
        Anyone can audit the escrow contract. No Sunvasi-controlled custody —
        just code, executed.
      </p>
    ),
    cta: {
      label: "Open Trustless Work viewer",
      href: "https://viewer.trustlesswork.com/CC3VPB54NJ25KUFDLAULK7FGEZIOENMQYOBCEGUWO32ZA5YEGHDCG7VP",
    },
    visual: <SettlementVisual />,
  },
];

export function Showcase() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = SLIDES.length;

  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const jump = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  // Keyboard control: ← / → / space (next) / p (play/pause) / Esc (pause)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "p" || e.key === "P") {
        setPlaying((p) => !p);
      } else if (e.key === "Escape") {
        setPlaying(false);
      } else if (e.key >= "1" && e.key <= "9") {
        const n = Number(e.key) - 1;
        if (n < total) jump(n);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, jump, total]);

  // Auto-advance when playing — uses each slide's stage time.
  useEffect(() => {
    if (!playing) return;
    const ms = SLIDES[index]?.durationMs ?? 8_000;
    const t = window.setTimeout(() => {
      if (index < total - 1) setIndex((i) => i + 1);
      else setPlaying(false);
    }, ms);
    return () => window.clearTimeout(t);
  }, [playing, index, total]);

  const slide = SLIDES[index]!;
  const totalSeconds = useMemo(
    () => Math.round(SLIDES.reduce((s, x) => s + x.durationMs, 0) / 1000),
    [],
  );

  return (
    <div className="relative min-h-svh w-full overflow-hidden bg-bg">
      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 lg:px-10 py-5">
        <div className="flex items-center gap-3 font-mono text-mono-sm text-fg-subtle">
          <span className="uppercase tracking-[0.16em]">Sunvasi · Showcase</span>
          <span className="text-fg">{slide.ts}</span>
          <span>·</span>
          <span>
            {index + 1} of {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded border border-border hover:border-border-strong px-3 py-1.5 text-body-sm text-fg-muted hover:text-fg transition-colors"
          >
            {playing ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Auto-play · {totalSeconds}s
              </>
            )}
          </button>
        </div>
      </header>

      {/* Progress dots */}
      <div className="absolute top-16 inset-x-0 z-30 flex items-center justify-center gap-2 px-6">
        {SLIDES.map((s, i) => (
          <button
            key={s.ts}
            type="button"
            onClick={() => jump(i)}
            aria-label={`Jump to slide ${i + 1}`}
            className={cn(
              "h-1 rounded-full transition-all duration-300 ease-sunvasi",
              i === index
                ? "bg-accent w-12"
                : i < index
                  ? "bg-fg-muted w-6"
                  : "bg-border w-6 hover:bg-fg-subtle",
            )}
          />
        ))}
      </div>

      {/* Slide content */}
      <main className="relative z-10 min-h-svh flex items-center justify-center px-6 lg:px-16 py-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="mx-auto w-full max-w-[1280px] grid lg:grid-cols-[0.85fr_1fr] gap-10 lg:gap-20 items-center"
          >
            <div>
              <p className="eyebrow">{slide.eyebrow}</p>
              <h1 className="mt-6 font-display text-display-2xl text-fg leading-[0.96] tracking-[-0.025em]">
                {slide.title}
              </h1>
              <div className="mt-8 text-body-lg text-fg-muted max-w-[52ch] leading-[1.55]">
                {slide.body}
              </div>
              <a
                href={slide.cta.href}
                target={slide.cta.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="mt-10 inline-flex items-center gap-2 rounded bg-accent text-accent-fg hover:bg-accent-hover px-5 py-3 text-body-sm font-medium transition-colors duration-150 ease-sunvasi"
              >
                {slide.cta.label}
                {slide.cta.href.startsWith("http") ? (
                  <ExternalLink className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </a>
            </div>
            <div className="min-w-0">{slide.visual}</div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Side nav arrows */}
      <button
        type="button"
        onClick={prev}
        disabled={index === 0}
        aria-label="Previous slide"
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 h-10 w-10 inline-flex items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted hover:text-fg hover:border-border-strong transition-colors duration-150 disabled:opacity-30"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={next}
        disabled={index === total - 1}
        aria-label="Next slide"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-30 h-10 w-10 inline-flex items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted hover:text-fg hover:border-border-strong transition-colors duration-150 disabled:opacity-30"
      >
        <ArrowRight className="h-4 w-4" />
      </button>

      {/* Hint footer */}
      <footer className="absolute bottom-0 inset-x-0 z-30 flex items-center justify-between px-6 lg:px-10 py-5 font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.14em]">
        <span className="hidden md:inline-flex items-center gap-3">
          <span>← / →</span>
          <span>Space</span>
          <span>1–{total}</span>
          <span>P · auto-play</span>
          <span>Esc · pause</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          Made for the corridor
        </span>
      </footer>
    </div>
  );
}
