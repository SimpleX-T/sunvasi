import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a numeric amount as USDC with mono-friendly grouping. */
export function formatUsdc(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a Stellar/EVM address as `ABCD…WXYZ`. */
export function shortenAddress(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Greeting based on local hour. */
export function timeOfDayGreeting(d: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

/** Relative time formatter, English-only, compact. */
const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
export function relativeTime(from: Date | string | number, now: Date = new Date()): string {
  const t = typeof from === "string" || typeof from === "number" ? new Date(from) : from;
  const diffMs = t.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (abs < minute) return "just now";
  if (abs < hour) return RTF.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return RTF.format(Math.round(diffMs / hour), "hour");
  if (abs < week) return RTF.format(Math.round(diffMs / day), "day");
  return RTF.format(Math.round(diffMs / week), "week");
}

/** 8-char human-friendly id. Avoids visually-confusing characters. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function shortId(length = 8): string {
  let out = "";
  const buf = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < length; i++) {
    const b = buf[i] ?? 0;
    out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}

/** Sleep helper. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
