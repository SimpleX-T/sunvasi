import type { TwNetwork } from "./types";

/* ---------------------------------------------------------------------------
 * Public Escrow Viewer deep-link.
 *   The viewer is a Trustless Work OSS dApp. Until the canonical hosted URL is
 *   confirmed, this helper reads from env (`NEXT_PUBLIC_TW_VIEWER_URL`) and
 *   falls back to a sensible default.
 * ------------------------------------------------------------------------ */

const DEFAULT_VIEWER = "https://viewer.trustlesswork.com";

export function escrowViewerUrl(
  contractId: string | null | undefined,
  network: TwNetwork = "testnet",
): string | null {
  if (!contractId) return null;
  const base = process.env.NEXT_PUBLIC_TW_VIEWER_URL ?? DEFAULT_VIEWER;
  const url = new URL(`/escrow/${contractId}`, base);
  url.searchParams.set("network", network);
  return url.toString();
}
