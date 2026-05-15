import type {
  ApproveMilestoneInput,
  ChangeMilestoneStatusInput,
  DisputeMilestoneInput,
  EscrowState,
  FundEscrowInput,
  InitializeEscrowInput,
  ReleaseMilestoneFundsInput,
  ResolveMilestoneDisputeInput,
  SendTransactionInput,
  SendTransactionResponse,
  TwNetwork,
  UnsignedTransactionResponse,
} from "./types";

const BASE_URLS: Record<TwNetwork, string> = {
  testnet: "https://dev.api.trustlesswork.com",
  mainnet: "https://api.trustlesswork.com",
};

export class TrustlessWorkError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "TrustlessWorkError";
  }
}

export interface TrustlessWorkClientOptions {
  apiKey: string;
  network?: TwNetwork;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class TrustlessWorkClient {
  readonly apiKey: string;
  readonly network: TwNetwork;
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: TrustlessWorkClientOptions) {
    if (!opts.apiKey) throw new Error("TrustlessWorkClient: apiKey is required");
    this.apiKey = opts.apiKey;
    this.network = opts.network ?? "testnet";
    this.baseUrl = opts.baseUrl ?? BASE_URLS[this.network];
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<TResp, TBody = unknown>(
    path: string,
    method: "POST" | "GET",
    body?: TBody,
  ): Promise<TResp> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
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
          : null) ?? `Trustless Work request failed: ${res.status} ${res.statusText}`;
      throw new TrustlessWorkError(msg, res.status, parsed);
    }

    return parsed as TResp;
  }

  /* ---- Multi-release lifecycle ---- */

  initializeEscrow(input: InitializeEscrowInput): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>("/deployer/multi-release", "POST", input);
  }

  fundEscrow(input: FundEscrowInput): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>(
      "/escrow/multi-release/fund-escrow",
      "POST",
      input,
    );
  }

  approveMilestone(input: ApproveMilestoneInput): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>(
      "/escrow/multi-release/approve-milestone",
      "POST",
      input,
    );
  }

  changeMilestoneStatus(
    input: ChangeMilestoneStatusInput,
  ): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>(
      "/escrow/multi-release/change-milestone-status",
      "POST",
      input,
    );
  }

  releaseMilestoneFunds(
    input: ReleaseMilestoneFundsInput,
  ): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>(
      "/escrow/multi-release/release-milestone-funds",
      "POST",
      input,
    );
  }

  disputeMilestone(input: DisputeMilestoneInput): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>(
      "/escrow/multi-release/dispute-milestone",
      "POST",
      input,
    );
  }

  resolveMilestoneDispute(
    input: ResolveMilestoneDisputeInput,
  ): Promise<UnsignedTransactionResponse> {
    return this.request<UnsignedTransactionResponse>(
      "/escrow/multi-release/resolve-milestone-dispute",
      "POST",
      input,
    );
  }

  sendTransaction(input: SendTransactionInput): Promise<SendTransactionResponse> {
    return this.request<SendTransactionResponse>(
      "/helper/send-transaction",
      "POST",
      input,
    );
  }

  getEscrowByContractId(contractId: string): Promise<EscrowState | null> {
    return this.request<EscrowState | null>(
      `/indexer/get-escrow-by-contract-id?contractId=${encodeURIComponent(contractId)}`,
      "GET",
    );
  }
}

/* ---------------------------------------------------------------------------
 * Module-level default client. Lazy-instantiated from env so unit tests can
 * construct their own.
 * ------------------------------------------------------------------------ */

let _default: TrustlessWorkClient | undefined;
export function getTrustlessWork(): TrustlessWorkClient {
  if (_default) return _default;
  const apiKey = process.env.TRUSTLESS_WORK_API_KEY;
  if (!apiKey) throw new Error("TRUSTLESS_WORK_API_KEY is not set");
  const network = (process.env.TRUSTLESS_WORK_NETWORK as TwNetwork | undefined) ?? "testnet";
  _default = new TrustlessWorkClient({ apiKey, network });
  return _default;
}

export function isTrustlessWorkConfigured(): boolean {
  return Boolean(process.env.TRUSTLESS_WORK_API_KEY);
}
