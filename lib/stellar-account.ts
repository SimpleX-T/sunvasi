/* ---------------------------------------------------------------------------
 * Stellar account preparation — keeps web3 mechanics invisible to the user.
 *
 * Sunvasi creates wallets via Privy, but a fresh keypair is useless on
 * Stellar until two things happen:
 *
 *   1. ACTIVATION  — the account needs ~1 XLM reserve on-chain.
 *      testnet  → Friendbot funds it for free
 *      mainnet  → Sunvasi treasury account sends 2 XLM (configurable)
 *
 *   2. TRUSTLINE   — the account needs a `changeTrust` op signed by the
 *      wallet owner to authorise holding USDC. We build the op server-side
 *      and have Privy raw-sign the hash, then submit to Horizon.
 *
 * `ensureFundableAccount` orchestrates both, idempotently. Safe to call on
 * every sign-in — it short-circuits when the account is already prepared.
 * ------------------------------------------------------------------------ */

import {
  Account,
  Asset,
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { rawSignHash } from "./privy-server";
import { attachRawSignature, toSignedXdr } from "./stellar-tx";
import { USDC_ASSET_CODE, USDC_ISSUERS, getNetwork, type StellarNetwork } from "./stellar";
import { logger } from "./logger";

const HORIZON_URL: Record<StellarNetwork, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  mainnet: "https://horizon.stellar.org",
};

const FRIENDBOT_URL = "https://friendbot.stellar.org";

interface HorizonAccount {
  account_id: string;
  sequence: string;
  balances: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
  }>;
}

/** Returns the account record from Horizon, or null if the account does not
 * exist on the network yet. */
export async function fetchAccount(
  address: string,
  network: StellarNetwork,
): Promise<HorizonAccount | null> {
  const res = await fetch(`${HORIZON_URL[network]}/accounts/${address}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Horizon /accounts/${address.slice(0, 8)}… → ${res.status}`);
  }
  return (await res.json()) as HorizonAccount;
}

/** Poll Horizon until the account appears or attempts are exhausted. Used
 * after Friendbot funding to defeat the ~1–5s lag before Horizon indexes the
 * new account. */
async function waitForAccount(
  address: string,
  network: StellarNetwork,
  { maxAttempts = 8, delayMs = 800 } = {},
): Promise<HorizonAccount | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const a = await fetchAccount(address, network);
    if (a) return a;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export function accountHasUsdcTrustline(
  account: HorizonAccount,
  network: StellarNetwork,
): boolean {
  const issuer = USDC_ISSUERS[network];
  return account.balances.some(
    (b) =>
      b.asset_code === USDC_ASSET_CODE &&
      b.asset_issuer === issuer,
  );
}

/** Activate a new account on testnet via Friendbot. No-op on mainnet (where
 * sponsorship must come from a configured treasury — see TODO below). */
export async function activateTestnetAccount(address: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    const text = await res.text();
    // Friendbot returns 400 with `op_already_exists` if the account exists
    // already — that's fine, treat as success.
    if (/op_already_exists|createAccountAlreadyExist/i.test(text)) return;
    throw new Error(`Friendbot funding failed: ${res.status} ${text.slice(0, 160)}`);
  }
}

/** Build, raw-sign with Privy, and submit a USDC trustline `changeTrust` op
 * for the user's account. Network passphrase + USDC issuer derived from the
 * Sunvasi network env. */
export async function establishUsdcTrustline(args: {
  walletId: string;
  address: string;
  network: StellarNetwork;
}): Promise<{ tx_hash: string }> {
  const { walletId, address, network } = args;
  const networkPassphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  const usdc = new Asset(USDC_ASSET_CODE, USDC_ISSUERS[network]);

  // Load the account afresh so we have a current sequence number.
  const account = await fetchAccount(address, network);
  if (!account) {
    throw new Error("Cannot establish trustline before account is activated.");
  }

  // Use the SDK's Account class — it implements the
  // accountId/sequenceNumber/incrementSequenceNumber protocol that
  // TransactionBuilder relies on. Hand-rolling these as constant getters made
  // `incrementSequenceNumber` a no-op, which produced txs at the existing
  // sequence (sequence-mismatch rejections from Horizon).
  const sdkAccount = new Account(account.account_id, account.sequence);

  const tx = new TransactionBuilder(sdkAccount, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(180)
    .build();
  const hash = Buffer.from(tx.hash()).toString("hex");
  const signatureHex = await rawSignHash(walletId, hash);
  attachRawSignature(tx, address, signatureHex);
  const signedXdr = toSignedXdr(tx);

  // Submit to Horizon. POST /transactions expects form-encoded `tx=<xdr>`.
  const body = `tx=${encodeURIComponent(signedXdr)}`;
  const res = await fetch(`${HORIZON_URL[network]}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && parsed !== null && "extras" in parsed
        ? JSON.stringify((parsed as Record<string, unknown>).extras)
        : `Horizon /transactions → ${res.status}`;
    throw new Error(`Trustline submission failed: ${msg.slice(0, 240)}`);
  }
  const txHash =
    parsed && typeof parsed === "object" && parsed !== null && "hash" in parsed
      ? String((parsed as Record<string, unknown>).hash)
      : "";
  return { tx_hash: txHash };
}

/** Top-level orchestrator. Always best-effort; throws only if a step that
 * cannot be retried later fails (e.g. trustline submission errored). Returns
 * a summary of what it did. */
export async function ensureFundableAccount(args: {
  walletId: string;
  address: string;
}): Promise<{
  network: StellarNetwork;
  activated: boolean;
  trustline_established: boolean;
  already_ready: boolean;
  trustline_tx_hash?: string;
}> {
  const network = getNetwork();
  // 1. Check current state
  let account = await fetchAccount(args.address, network);
  let activated = false;
  if (!account) {
    if (network === "testnet") {
      logger.info("stellar.activate.friendbot", { address: args.address });
      await activateTestnetAccount(args.address);
      // Horizon is eventually-consistent — after Friendbot it can take a few
      // seconds for the new account to show. Poll instead of single re-fetch.
      account = await waitForAccount(args.address, network);
      activated = true;
    } else {
      // TODO: mainnet sponsorship from SUNVASI_TREASURY_ACCOUNT.
      throw new Error(
        "Account not activated. Mainnet sponsorship is not yet configured (set SUNVASI_TREASURY_ACCOUNT).",
      );
    }
  }
  if (!account) {
    throw new Error("Account still not found after activation attempt (Horizon lag).");
  }

  // 2. Trustline?
  if (accountHasUsdcTrustline(account, network)) {
    return {
      network,
      activated,
      trustline_established: false,
      already_ready: !activated,
    };
  }

  logger.info("stellar.trustline.establish", { address: args.address, network });
  const trustline = await establishUsdcTrustline({
    walletId: args.walletId,
    address: args.address,
    network,
  });

  return {
    network,
    activated,
    trustline_established: true,
    already_ready: false,
    trustline_tx_hash: trustline.tx_hash,
  };
}
