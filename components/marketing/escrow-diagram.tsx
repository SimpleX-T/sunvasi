"use client";

import { motion } from "framer-motion";

/* ---------------------------------------------------------------------------
 * Hero diagram. Three labelled nodes (Client → Escrow → Freelancer) with a
 * token that loops along the line from client to escrow, then escrow to
 * freelancer. Hairlines, no fills. Calm.
 * ------------------------------------------------------------------------ */

const STAGE_W = 520;
const STAGE_H = 320;

// Master cycle = 4.8s: deposit (0–1.6) | hold (1.6–2.4) | release (2.4–4.0) | rest (4.0–4.8)
const EASE = [0.32, 0.72, 0, 1] as const;

const NODES = [
  { x: 60, y: 160, label: "Client" },
  { x: 260, y: 80, label: "Escrow" },
  { x: 460, y: 160, label: "Freelancer" },
];

// Compute points along a quadratic bezier — gives us proper curve-following motion
const bezierPoint = (
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) => ({
  x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x,
  y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y,
});

// Segment 1: client → escrow
const seg1Start = { x: NODES[0]!.x + 36, y: NODES[0]!.y };
const seg1Ctrl = {
  x: (NODES[0]!.x + NODES[1]!.x) / 2,
  y: (NODES[0]!.y + NODES[1]!.y) / 2 - 32,
};
const seg1End = { x: NODES[1]!.x - 36, y: NODES[1]!.y };

// Segment 2: escrow → freelancer
const seg2Start = { x: NODES[1]!.x + 36, y: NODES[1]!.y };
const seg2Ctrl = {
  x: (NODES[1]!.x + NODES[2]!.x) / 2,
  y: (NODES[1]!.y + NODES[2]!.y) / 2 - 32,
};
const seg2End = { x: NODES[2]!.x - 36, y: NODES[2]!.y };

const SAMPLE_TS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
const seg1Path = SAMPLE_TS.map((t) =>
  bezierPoint(t, seg1Start, seg1Ctrl, seg1End),
);
const seg2Path = SAMPLE_TS.map((t) =>
  bezierPoint(t, seg2Start, seg2Ctrl, seg2End),
);

const path1D = `M ${seg1Start.x} ${seg1Start.y} Q ${seg1Ctrl.x} ${seg1Ctrl.y} ${seg1End.x} ${seg1End.y}`;
const path2D = `M ${seg2Start.x} ${seg2Start.y} Q ${seg2Ctrl.x} ${seg2Ctrl.y} ${seg2End.x} ${seg2End.y}`;

export function EscrowDiagram() {
  return (
    <div className="relative w-full max-w-[560px] aspect-[520/320] mx-auto">
      <svg
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        className="w-full h-full"
        aria-hidden
      >
        <defs>
          <pattern
            id="grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="var(--border)"
              strokeWidth="0.5"
            />
          </pattern>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="vaultGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Faint guide grid */}
        <rect
          width={STAGE_W}
          height={STAGE_H}
          fill="url(#grid)"
          opacity="0.18"
        />

        {/* Ambient glow behind escrow — breathes during the hold */}
        <motion.circle
          cx={NODES[1]!.x}
          cy={NODES[1]!.y}
          r={96}
          fill="url(#vaultGlow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 1, 0.6, 1, 0.3, 0] }}
          transition={{
            duration: 4.8,
            times: [0, 0.25, 0.36, 0.42, 0.5, 0.6, 0.85],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />

        {/* Dotted base paths — the "potential" channel */}
        <path
          d={path1D}
          stroke="var(--border-strong)"
          strokeWidth="0.75"
          strokeDasharray="2 4"
          fill="none"
          opacity="0.6"
        />
        <path
          d={path2D}
          stroke="var(--border-strong)"
          strokeWidth="0.75"
          strokeDasharray="2 4"
          fill="none"
          opacity="0.6"
        />

        {/* Active path 1 — draws itself during deposit */}
        <motion.path
          d={path1D}
          stroke="url(#flowGrad)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 0, 1, 1, 1],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: 4.8,
            times: [0, 0.04, 0.33, 0.4, 0.46],
            ease: EASE,
            repeat: Infinity,
          }}
        />

        {/* Active path 2 — draws itself during release */}
        <motion.path
          d={path2D}
          stroke="url(#flowGrad)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: [0, 0, 1, 1, 1],
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{
            duration: 4.8,
            times: [0, 0.5, 0.83, 0.9, 0.96],
            ease: EASE,
            repeat: Infinity,
          }}
        />

        {/* Deposit token — follows the curve from client to escrow */}
        <motion.circle
          r={5}
          fill="var(--accent)"
          cx={seg1Start.x}
          cy={seg1Start.y}
          animate={{
            cx: seg1Path.map((p) => p.x),
            cy: seg1Path.map((p) => p.y),
            opacity: [0, 1, 1, 1, 1, 1, 1, 0],
          }}
          transition={{
            duration: 1.6,
            ease: EASE,
            repeat: Infinity,
            repeatDelay: 3.2,
            times: [0, 0.08, 0.2, 0.4, 0.6, 0.78, 0.92, 1],
          }}
        />
        {/* Soft halo trailing the deposit token */}
        <motion.circle
          r={10}
          fill="var(--accent)"
          fillOpacity={0.25}
          cx={seg1Start.x}
          cy={seg1Start.y}
          animate={{
            cx: seg1Path.map((p) => p.x),
            cy: seg1Path.map((p) => p.y),
            opacity: [0, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0],
          }}
          transition={{
            duration: 1.6,
            ease: EASE,
            repeat: Infinity,
            repeatDelay: 3.2,
            times: [0, 0.08, 0.2, 0.4, 0.6, 0.78, 0.92, 1],
          }}
        />

        {/* Release token — follows the curve from escrow to freelancer */}
        <motion.circle
          r={5}
          fill="var(--accent)"
          cx={seg2Start.x}
          cy={seg2Start.y}
          initial={{ opacity: 0 }}
          animate={{
            cx: seg2Path.map((p) => p.x),
            cy: seg2Path.map((p) => p.y),
            opacity: [0, 1, 1, 1, 1, 1, 1, 0],
          }}
          transition={{
            duration: 1.6,
            delay: 2.4,
            ease: EASE,
            repeat: Infinity,
            repeatDelay: 3.2,
            times: [0, 0.08, 0.2, 0.4, 0.6, 0.78, 0.92, 1],
          }}
        />
        <motion.circle
          r={10}
          fill="var(--accent)"
          fillOpacity={0.25}
          cx={seg2Start.x}
          cy={seg2Start.y}
          initial={{ opacity: 0 }}
          animate={{
            cx: seg2Path.map((p) => p.x),
            cy: seg2Path.map((p) => p.y),
            opacity: [0, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0],
          }}
          transition={{
            duration: 1.6,
            delay: 2.4,
            ease: EASE,
            repeat: Infinity,
            repeatDelay: 3.2,
            times: [0, 0.08, 0.2, 0.4, 0.6, 0.78, 0.92, 1],
          }}
        />

        {/* Escrow hold ring — pulses outward during the held phase */}
        <motion.circle
          cx={NODES[1]!.x}
          cy={NODES[1]!.y}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1}
          initial={{ r: 28, opacity: 0 }}
          animate={{
            r: [28, 44, 56],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 1.4,
            delay: 1.5,
            ease: "easeOut",
            repeat: Infinity,
            repeatDelay: 3.4,
          }}
        />

        {/* Nodes */}
        {NODES.map((n, idx) => {
          const isEscrow = idx === 1;
          return (
            <g key={n.label}>
              <motion.rect
                x={n.x - 36}
                y={n.y - 22}
                width={72}
                height={44}
                rx={4}
                fill="var(--bg-elevated)"
                stroke="var(--border)"
                strokeWidth={1}
                initial={{ opacity: 0, y: n.y - 18 }}
                animate={{ opacity: 1, y: n.y - 22 }}
                transition={{
                  delay: 0.15 + idx * 0.12,
                  duration: 0.5,
                  ease: EASE,
                }}
              />
              {/* Escrow node gets a synced accent border overlay during hold */}
              {isEscrow && (
                <motion.rect
                  x={n.x - 36}
                  y={n.y - 22}
                  width={72}
                  height={44}
                  rx={4}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0, 1, 1, 0] }}
                  transition={{
                    duration: 4.8,
                    times: [0, 0.32, 0.4, 0.5, 0.58],
                    ease: "easeInOut",
                    repeat: Infinity,
                  }}
                />
              )}
              {/* Tiny status indicator dot, top-right of each node */}
              <motion.circle
                cx={n.x + 28}
                cy={n.y - 14}
                r={1.5}
                fill={isEscrow ? "var(--accent)" : "var(--fg-subtle)"}
                initial={{ opacity: 0 }}
                animate={{ opacity: isEscrow ? [0.4, 1, 0.4] : 0.4 }}
                transition={{
                  duration: 1.6,
                  delay: 0.8 + idx * 0.12,
                  ease: "easeInOut",
                  repeat: isEscrow ? Infinity : 0,
                }}
              />
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                className="font-mono"
                fill="var(--fg-muted)"
                fontSize={11}
                letterSpacing="0.08em"
              >
                {n.label.toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Flow labels — fade in only during their respective phase */}
        <motion.text
          x={(NODES[0]!.x + NODES[1]!.x) / 2}
          y={(NODES[0]!.y + NODES[1]!.y) / 2 - 52}
          textAnchor="middle"
          className="font-mono"
          fill="var(--accent)"
          fontSize={10}
          letterSpacing="0.16em"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.9, 0.9, 0] }}
          transition={{
            duration: 4.8,
            times: [0, 0.04, 0.18, 0.3, 0.4],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          → FUNDING
        </motion.text>

        <motion.text
          x={NODES[1]!.x}
          y={NODES[1]!.y - 38}
          textAnchor="middle"
          className="font-mono"
          fill="var(--accent)"
          fontSize={10}
          letterSpacing="0.16em"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.9, 0.9, 0] }}
          transition={{
            duration: 4.8,
            times: [0, 0.34, 0.42, 0.5, 0.58],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          HELD
        </motion.text>

        <motion.text
          x={(NODES[1]!.x + NODES[2]!.x) / 2}
          y={(NODES[1]!.y + NODES[2]!.y) / 2 - 52}
          textAnchor="middle"
          className="font-mono"
          fill="var(--accent)"
          fontSize={10}
          letterSpacing="0.16em"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0, 0.9, 0.9, 0] }}
          transition={{
            duration: 4.8,
            times: [0, 0.5, 0.65, 0.78, 0.88],
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          RELEASING →
        </motion.text>

        {/* Baseline ledger */}
        <line
          x1={32}
          y1={STAGE_H - 32}
          x2={STAGE_W - 32}
          y2={STAGE_H - 32}
          stroke="var(--border)"
          strokeWidth={0.5}
        />
        {/* Tick marks along the baseline — financial-chart feel */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={32 + (STAGE_W - 64) * p}
            x2={32 + (STAGE_W - 64) * p}
            y1={STAGE_H - 36}
            y2={STAGE_H - 28}
            stroke="var(--border)"
            strokeWidth={0.5}
          />
        ))}
        <text
          x={STAGE_W / 2}
          y={STAGE_H - 12}
          textAnchor="middle"
          fontSize={10}
          className="font-mono"
          fill="var(--fg-subtle)"
          letterSpacing="0.16em"
        >
          M01/03 — USDC 500.00 — AUTO-RELEASE 07D
        </text>
      </svg>
    </div>
  );
}
