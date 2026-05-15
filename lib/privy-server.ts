/* ---------------------------------------------------------------------------
 * Server-side Privy client. Talks directly to the Privy REST API so we get
 * the same surface regardless of which version of @privy-io/server-auth is
 * installed. All calls are authenticated with Basic auth (app_id : app_secret)
 * and require the privy-app-id header.
 *
 *   create:  POST /v1/wallets        → { id, address, ... }
 *   sign:    POST /v1/wallets/{id}/raw_sign → { data: { signature, encoding } }
 *   get:     GET  /v1/wallets/{id}
 *   list:    GET  /v1/users/{userId}/wallets
 *
 * Server-only — never import from a "use client" file.
 * ------------------------------------------------------------------------ */

import { logger } from "./logger";

const PRIVY_API = "https://api.privy.io/v1";

export interface PrivyWallet {
  id: string;
  address: string;
  chain_type: string;
  owner?: { user_id?: string } | null;
  display_name?: string | null;
}

export interface PrivyRawSignResult {
  method: string;
  data: { signature: string; encoding: string };
}

export class PrivyServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "PrivyServerError";
  }
}

function authHeader(): Record<string, string> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set");
  }
  const basic = Buffer.from(`${appId}:${secret}`).toString("base64");
  return {
    "privy-app-id": appId,
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${PRIVY_API}${path}`, {
    method,
    headers: authHeader(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === "object" && parsed !== null && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ?? `Privy ${method} ${path} failed: ${res.status}`;
    throw new PrivyServerError(msg, res.status, parsed);
  }
  return parsed as T;
}

export function isPrivyServerConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

/** Create a Stellar-chain embedded wallet owned by `userId` (Privy DID). */
export async function createStellarWallet(userId: string): Promise<PrivyWallet> {
  logger.info("privy.wallet.create", { userId, chain: "stellar" });
  return request<PrivyWallet>("/wallets", "POST", {
    chain_type: "stellar",
    owner: { user_id: userId },
    display_name: "Sunvasi payout wallet",
  });
}

/** Fetch a single wallet by ID. */
export async function getWallet(walletId: string): Promise<PrivyWallet> {
  return request<PrivyWallet>(`/wallets/${walletId}`, "GET");
}

/** List all wallets owned by a Privy user. */
export async function listUserWallets(userId: string): Promise<{ data: PrivyWallet[] }> {
  return request<{ data: PrivyWallet[] }>(`/users/${userId}/wallets`, "GET");
}

/** Raw-sign a 32-byte hash with the given Privy wallet. Returns hex signature
 * with the leading `0x` stripped — ready to be passed to Stellar SDK as a
 * raw signature Buffer. */
export async function rawSignHash(walletId: string, hashHex: string): Promise<string> {
  const normalised = hashHex.startsWith("0x") ? hashHex : `0x${hashHex}`;
  const res = await request<PrivyRawSignResult>(
    `/wallets/${walletId}/raw_sign`,
    "POST",
    { params: { hash: normalised } },
  );
  const sig = res.data?.signature;
  if (!sig) throw new Error("Privy raw_sign returned no signature");
  return sig.startsWith("0x") ? sig.slice(2) : sig;
}

/** Idempotently ensure a Stellar wallet exists for a user. Returns the wallet
 * record (creating one if absent). Safe to call on every sign-in. */
export async function ensureStellarWallet(userId: string): Promise<PrivyWallet> {
  try {
    const existing = await listUserWallets(userId);
    const stellar = existing.data?.find((w) => w.chain_type === "stellar");
    if (stellar) return stellar;
  } catch (e) {
    // listing failure shouldn't block creation
    logger.warn("privy.list_user_wallets_failed", {
      userId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  return createStellarWallet(userId);
}
