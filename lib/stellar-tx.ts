/* ---------------------------------------------------------------------------
 * Stellar transaction helpers for the Privy raw-sign flow.
 *
 *   1. Parse the unsigned XDR returned by Trustless Work.
 *   2. Compute the transaction hash that needs to be signed.
 *   3. Attach a raw Ed25519 signature (from Privy) as a DecoratedSignature.
 *   4. Serialise back to base64 XDR ready for /helper/send-transaction.
 *
 * Soroban Trustless Work escrows are submitted as fee-bumped transactions in
 * some flows; we handle both Transaction and FeeBumpTransaction shapes by
 * using TransactionBuilder.fromXDR which returns either type, both of which
 * expose `.hash()` + a mutable `.signatures` array of DecoratedSignature.
 * ------------------------------------------------------------------------ */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  xdr,
  type FeeBumpTransaction,
  type Transaction,
} from "@stellar/stellar-sdk";
import type { StellarNetwork } from "./stellar";

type ParsedTx = Transaction | FeeBumpTransaction;

export function parseUnsignedXdr(xdrBase64: string, network: StellarNetwork): ParsedTx {
  const passphrase =
    network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  // TransactionBuilder.fromXDR returns Transaction | FeeBumpTransaction.
  return TransactionBuilder.fromXDR(xdrBase64, passphrase) as ParsedTx;
}

/** Hex of the 32-byte transaction hash that must be signed. */
export function txHashHex(tx: ParsedTx): string {
  return Buffer.from(tx.hash()).toString("hex");
}

/** Attach an Ed25519 signature (hex, no leading 0x) produced by Privy
 * raw-sign on the tx hash. Mutates `tx`. */
export function attachRawSignature(
  tx: ParsedTx,
  signerAddress: string,
  signatureHex: string,
): void {
  const kp = Keypair.fromPublicKey(signerAddress);
  const signature = Buffer.from(signatureHex, "hex");
  const hint = kp.signatureHint();
  const decorated = new xdr.DecoratedSignature({ hint, signature });
  tx.signatures.push(decorated);
}

/** Final base64 XDR envelope ready for TW /helper/send-transaction. */
export function toSignedXdr(tx: ParsedTx): string {
  return tx.toEnvelope().toXDR("base64");
}

/** One-shot: parse → hash → return what needs to be signed. */
export function prepareForSigning(
  xdrBase64: string,
  network: StellarNetwork,
): { tx: ParsedTx; hashHex: string } {
  const tx = parseUnsignedXdr(xdrBase64, network);
  return { tx, hashHex: txHashHex(tx) };
}
