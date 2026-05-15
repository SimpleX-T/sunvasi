/* ---------------------------------------------------------------------------
 * Privy server-side auth helpers.
 *
 *   Two flavours of "who is this request from?":
 *
 *   • readUserFromHeaders(headers) — SYNCHRONOUS, signature-NOT-verified.
 *     Decodes the JWT's `sub` claim only. Cheap, no network. Useful when the
 *     route's authorisation comes from elsewhere (e.g. comparing DID to a
 *     row's owner field, which an attacker without the matching DB row can't
 *     exploit) or when you'll verify downstream.
 *
 *   • verifyUserFromHeaders(headers) — ASYNC, signature-verified via Privy.
 *     Returns null on bad signature / expired / forged tokens. Required for
 *     anything where the DID itself is the authorisation gate (e.g. moving
 *     money, restricted-access checks).
 *
 *   Privy issues a JWT on the cookie `privy-token`; the client also sets a
 *   `privy-id-token` header on fetches via the Privy SDK. We accept both.
 * ------------------------------------------------------------------------ */

import { PrivyClient, type AuthTokenClaims } from "@privy-io/server-auth";
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

/** Quick decode of the JWT `sub` claim. NOT verified. */
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

/* ---------------------------------------------------------------------------
 * Verified path (uses @privy-io/server-auth → signature check + claims).
 * ------------------------------------------------------------------------ */

let _client: PrivyClient | undefined;
function getPrivyClient(): PrivyClient {
  if (_client) return _client;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required");
  }
  _client = new PrivyClient(appId, secret);
  return _client;
}

export interface VerifiedAuth {
  did: string;
  sessionId?: string;
  /** The raw verified claims from Privy. */
  claims: AuthTokenClaims;
  /** The original id-token, useful when you need to pass it to getUser({idToken}). */
  token: string;
}

/** Verify the JWT signature and return the user identity. Returns null when
 * no token is present, signature is bad, expired, or claims are malformed.
 * Use this — not `readUserFromHeaders` — for any auth-sensitive route. */
export async function verifyUserFromHeaders(
  headers: Headers,
): Promise<VerifiedAuth | null> {
  const token = privyTokenFromHeaders(headers);
  if (!token) return null;
  if (!process.env.PRIVY_APP_SECRET) {
    // No secret to verify against — fall back to decode-only so dev still
    // works without server creds. In production PRIVY_APP_SECRET must be set.
    const u = decodePrivyToken(token);
    if (!u) return null;
    logger.warn("privy.verify_skipped", { reason: "no_secret" });
    return {
      did: u.did,
      claims: { userId: u.did } as unknown as AuthTokenClaims,
      token,
    };
  }
  try {
    const claims = await getPrivyClient().verifyAuthToken(token);
    return {
      did: claims.userId,
      sessionId: claims.sessionId,
      claims,
      token,
    };
  } catch (e) {
    logger.warn("privy.verify_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
