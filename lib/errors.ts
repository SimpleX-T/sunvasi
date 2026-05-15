/* ---------------------------------------------------------------------------
 * Error reporter — single API surface for capturing exceptions / notable
 * events, so adding Sentry / Axiom / Datadog later is a one-file change.
 *
 *   Today: structured JSON to stdout via the logger. Vercel collects this.
 *
 *   To wire Sentry: install `@sentry/nextjs`, follow Sentry's standard Next.js
 *   setup (sentry.client.config.ts, sentry.server.config.ts, withSentryConfig
 *   in next.config). Then replace the body of captureException /
 *   captureMessage below with the matching `Sentry.*` calls. Every caller in
 *   the codebase already uses these helpers, so no other file changes.
 * ------------------------------------------------------------------------ */

import { logger } from "./logger";

type Level = "fatal" | "error" | "warning" | "info";

export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(message, { ...context, stack });
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>,
  level: Level = "info",
): void {
  if (level === "error" || level === "fatal") logger.error(message, context);
  else if (level === "warning") logger.warn(message, context);
  else logger.info(message, context);
}
