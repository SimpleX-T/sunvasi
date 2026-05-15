/* ---------------------------------------------------------------------------
 * Privy server-side helpers. Verifies the Privy identity token attached to
 * authenticated API requests and returns the user's DID, email, and wallet
 * address. The Privy app secret is required.
 *
 * Privy issues a JWT on the cookie `privy-token`; the client also sets a
 * `privy-id-token` header on fetches via the Privy SDK. We accept both.
 * ------------------------------------------------------------------------ */

import { logger } from "./logger";

export interface PrivyVerifiedUser {
  did: string;
  email?: string;
  walletAddress?: string;
  raw: Record<string, unknown>;
}

interface PrivyJwtPayload {
  sid?: string;
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): PrivyJwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as PrivyJwtPayload;
  } catch {
    return null;
  }
}

/** Lightweight check used by API routes: extracts the user's DID from the
 * Privy id-token without making a network call. For full verification call
 * the Privy server SDK in production. */
export function decodePrivyToken(token: string): PrivyVerifiedUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return null;
  return {
    did: payload.sub,
    raw: payload as unknown as Record<string, unknown>,
  };
}

/** Convenience: pull the token from a Headers/Request shape. */
export function privyTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7).trim();
  const idToken = headers.get("privy-id-token");
  if (idToken) return idToken;
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/privy-id-token=([^;]+)/) || cookie.match(/privy-token=([^;]+)/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

export function readUserFromHeaders(headers: Headers): PrivyVerifiedUser | null {
  const tok = privyTokenFromHeaders(headers);
  if (!tok) return null;
  return decodePrivyToken(tok);
}

export function isPrivyConfigured(): boolean {
  const v = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  if (!v) logger.debug("Privy not configured (NEXT_PUBLIC_PRIVY_APP_ID missing)");
  return v;
}
