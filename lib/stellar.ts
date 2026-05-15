/* ---------------------------------------------------------------------------
 * Stellar helpers and chain constants.
 *
 *   • Sunvasi runs on Stellar/Soroban (per Trustless Work).
 *   • USDC issuer addresses differ per network — keep them here so the rest
 *     of the codebase imports from one source.
 *   • Address validation is loose (basic G... + length); for strict checks
 *     defer to `@stellar/stellar-sdk` StrKey.
 * ------------------------------------------------------------------------ */

export type StellarNetwork = "testnet" | "mainnet";

export const USDC_ISSUERS: Record<StellarNetwork, string> = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

export const USDC_ASSET_CODE = "USDC";

export const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

export const RPC_URL: Record<StellarNetwork, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban.stellar.org",
};

const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

export function isStellarAddress(addr: string | null | undefined): addr is string {
  return typeof addr === "string" && STELLAR_ADDR_RE.test(addr);
}

export function getNetwork(): StellarNetwork {
  const v = process.env.TRUSTLESS_WORK_NETWORK;
  return v === "mainnet" ? "mainnet" : "testnet";
}
