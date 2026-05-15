import type { TwNetwork } from "./types";

/* ---------------------------------------------------------------------------
 * Public Escrow Viewer deep-link.
 *   Trustless Work's hosted escrow viewer (OSS, https://viewer.trustlesswork.com)
 *   takes the Soroban contract ID as the only path segment:
 *     https://viewer.trustlesswork.com/{contractId}
 *   Override the base via `NEXT_PUBLIC_TW_VIEWER_URL` if you self-host.
 * ------------------------------------------------------------------------ */

const DEFAULT_VIEWER = "https://viewer.trustlesswork.com";

export function escrowViewerUrl(
  contractId: string | null | undefined,
  _network: TwNetwork = "testnet",
): string | null {
  if (!contractId) return null;
  const base = (
    process.env.NEXT_PUBLIC_TW_VIEWER_URL ?? DEFAULT_VIEWER
  ).replace(/\/$/, "");
  return `${base}/${encodeURIComponent(contractId)}`;
}
