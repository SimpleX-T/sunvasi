/* ---------------------------------------------------------------------------
 * Trustless Work on-chain action helpers.
 *
 *   Each function follows the same shape:
 *     1. Call TW endpoint → returns unsignedTransaction (XDR)
 *     2. Parse XDR with @stellar/stellar-sdk → compute tx.hash()
 *     3. Ask Privy to raw_sign the hash
 *     4. Attach the DecoratedSignature to the envelope
 *     5. POST the signed XDR to TW /helper/send-transaction
 *
 *   All operations are server-only; the signer's Privy wallet ID + Stellar
 *   public key are passed in.
 * ------------------------------------------------------------------------ */

import { getTrustlessWork } from "@/lib/trustless-work";
import { rawSignHash } from "@/lib/privy-server";
import { prepareForSigning, attachRawSignature, toSignedXdr } from "@/lib/stellar-tx";
import { getNetwork } from "@/lib/stellar";
import { logger } from "@/lib/logger";

export interface Signer {
  walletId: string;
  address: string;
}

export interface OnChainResult {
  ok: boolean;
  tx_hash: string | null;
  contract_id: string | null;
  /** Raw TW send-transaction body for debugging. */
  raw: unknown;
}

/** Sign the given unsigned XDR with `signer` (via Privy raw_sign) and
 * broadcast through TW's /helper/send-transaction. Throws on failure. */
export async function signAndBroadcast(
  unsignedXdr: string,
  signer: Signer,
): Promise<OnChainResult> {
  const network = getNetwork();
  const { tx, hashHex } = prepareForSigning(unsignedXdr, network);
  const sigHex = await rawSignHash(signer.walletId, hashHex);
  attachRawSignature(tx, signer.address, sigHex);
  const signedXdr = toSignedXdr(tx);
  const tw = getTrustlessWork();
  const result = await tw.sendTransaction({ signedXdr });
  const contractId =
    result?.contractId ??
    (result?.escrow &&
    typeof result.escrow === "object" &&
    "contractId" in (result.escrow as Record<string, unknown>)
      ? ((result.escrow as Record<string, unknown>).contractId as string)
      : null) ??
    null;
  return {
    ok: true,
    tx_hash: result?.hash ?? null,
    contract_id: contractId,
    raw: result,
  };
}

/** Fund an existing escrow with USDC. Signed by the funder (client). */
export async function fundEscrowOnChain(args: {
  escrowContractId: string;
  amount: number;
  signer: Signer;
}): Promise<OnChainResult> {
  const tw = getTrustlessWork();
  const init = await tw.fundEscrow({
    signer: args.signer.address,
    contractId: args.escrowContractId,
    amount: args.amount,
  });
  if (!init?.unsignedTransaction) {
    throw new Error("TW fundEscrow returned no unsignedTransaction");
  }
  return signAndBroadcast(init.unsignedTransaction, args.signer);
}

/** Mark a milestone's status as e.g. "done". Signed by the milestone's
 * service provider (freelancer). */
export async function changeMilestoneStatusOnChain(args: {
  escrowContractId: string;
  milestoneIndex: number;
  newStatus: string;
  signer: Signer;
}): Promise<OnChainResult> {
  const tw = getTrustlessWork();
  const init = await tw.changeMilestoneStatus({
    signer: args.signer.address,
    contractId: args.escrowContractId,
    milestoneIndex: String(args.milestoneIndex),
    newStatus: args.newStatus,
  });
  if (!init?.unsignedTransaction) {
    throw new Error("TW changeMilestoneStatus returned no unsignedTransaction");
  }
  return signAndBroadcast(init.unsignedTransaction, args.signer);
}

/** Approve a milestone. Signed by the approver (client). */
export async function approveMilestoneOnChain(args: {
  escrowContractId: string;
  milestoneIndex: number;
  signer: Signer;
}): Promise<OnChainResult> {
  const tw = getTrustlessWork();
  const init = await tw.approveMilestone({
    signer: args.signer.address,
    contractId: args.escrowContractId,
    milestoneIndex: String(args.milestoneIndex),
    approver: args.signer.address,
  });
  if (!init?.unsignedTransaction) {
    throw new Error("TW approveMilestone returned no unsignedTransaction");
  }
  return signAndBroadcast(init.unsignedTransaction, args.signer);
}

/** Release milestone funds to the receiver (freelancer). Signed by the
 * release signer (default = client in Sunvasi's setup). */
export async function releaseMilestoneFundsOnChain(args: {
  escrowContractId: string;
  milestoneIndex: number;
  signer: Signer;
}): Promise<OnChainResult> {
  const tw = getTrustlessWork();
  const init = await tw.releaseMilestoneFunds({
    contractId: args.escrowContractId,
    releaseSigner: args.signer.address,
    milestoneIndex: String(args.milestoneIndex),
  });
  if (!init?.unsignedTransaction) {
    throw new Error("TW releaseMilestoneFunds returned no unsignedTransaction");
  }
  return signAndBroadcast(init.unsignedTransaction, args.signer);
}

/** Resolve a disputed milestone by splitting funds between client and
 * freelancer per the arbitrator's verdict. Signed by the dispute resolver. */
export async function resolveMilestoneDisputeOnChain(args: {
  escrowContractId: string;
  milestoneIndex: number;
  distributions: Array<{ address: string; amount: number }>;
  signer: Signer;
}): Promise<OnChainResult> {
  const tw = getTrustlessWork();
  const init = await tw.resolveMilestoneDispute({
    contractId: args.escrowContractId,
    disputeResolver: args.signer.address,
    milestoneIndex: String(args.milestoneIndex),
    distributions: args.distributions,
  });
  if (!init?.unsignedTransaction) {
    throw new Error("TW resolveMilestoneDispute returned no unsignedTransaction");
  }
  return signAndBroadcast(init.unsignedTransaction, args.signer);
}

/** Best-effort wrapper that swallows + logs on-chain failures. Use when the
 * primary effect (DB update) should still succeed even if the chain call
 * fails — the caller can surface the broadcast error separately. */
export async function tryOnChain<T extends OnChainResult>(
  description: string,
  fn: () => Promise<T>,
): Promise<{ ok: boolean; result: T | null; error: string | null }> {
  try {
    const result = await fn();
    return { ok: true, result, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.warn("tw_action.failed", { description, error });
    return { ok: false, result: null, error };
  }
}
