/* ---------------------------------------------------------------------------
 * Trustless Work — typed payloads for the multi-release escrow API.
 *
 * Reference:
 *   https://docs.trustlesswork.com/trustless-work/api-rest/deploy-1
 *
 * All write endpoints return an unsigned XDR transaction. The caller signs it
 * with a Stellar wallet (Stellar Wallets Kit) and broadcasts via
 * `/helper/send-transaction`.
 * ------------------------------------------------------------------------ */

export type TwNetwork = "testnet" | "mainnet";

export interface TwRoles {
  approver: string;
  serviceProvider: string;
  releaseSigner: string;
  disputeResolver: string;
  platformAddress: string;
}

export interface TwMilestoneInput {
  description: string;
  amount: number;
  receiver: string;
}

export interface TwTrustline {
  address: string;
  symbol: string;
}

export interface InitializeEscrowInput {
  signer: string;
  engagementId: string;
  title: string;
  description: string;
  platformFee: number;
  roles: TwRoles;
  milestones: TwMilestoneInput[];
  trustline: TwTrustline;
}

export interface FundEscrowInput {
  signer: string;
  contractId: string;
  amount: number;
}

export interface ApproveMilestoneInput {
  signer: string;
  contractId: string;
  milestoneIndex: string;
  approver: string;
}

export interface ChangeMilestoneStatusInput {
  signer: string;
  contractId: string;
  milestoneIndex: string;
  newStatus: string;
}

export interface ReleaseMilestoneFundsInput {
  contractId: string;
  releaseSigner: string;
  milestoneIndex: string;
}

export interface DisputeMilestoneInput {
  signer: string;
  contractId: string;
  milestoneIndex: string;
}

export interface DisputeDistribution {
  address: string;
  amount: number;
}

export interface ResolveMilestoneDisputeInput {
  contractId: string;
  disputeResolver: string;
  milestoneIndex: string;
  distributions: DisputeDistribution[];
}

export interface UnsignedTransactionResponse {
  unsignedTransaction: string;
  status: string;
  message?: string;
}

export interface SendTransactionInput {
  signedXdr: string;
}

export interface SendTransactionResponse {
  status: string;
  hash?: string;
  contractId?: string;
  escrow?: Record<string, unknown>;
  message?: string;
}

export interface EscrowStateMilestone {
  description: string;
  amount: string;
  receiver: string;
  status: string;
  approved: boolean;
  flag?: boolean;
  disputeFlag?: boolean;
}

export interface EscrowState {
  contractId: string;
  engagementId: string;
  title: string;
  description: string;
  platformFee: number;
  roles: TwRoles;
  milestones: EscrowStateMilestone[];
  trustline: TwTrustline;
  balance?: string;
}
