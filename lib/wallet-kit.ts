"use client";

/* ---------------------------------------------------------------------------
 * Stellar Wallets Kit — client-side singleton used by the freelancer to sign
 * Trustless Work transactions.
 *
 *   • Supports Freighter, Albedo, xBull, Hana out of the box.
 *   • For "passkey-grade" UX a Passkey Kit module can be added later — the
 *     interface (signTransaction) remains the same.
 * ------------------------------------------------------------------------ */

import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  AlbedoModule,
  FreighterModule,
  xBullModule,
  HanaModule,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";

let _kit: StellarWalletsKit | undefined;

export function getWalletKit(): StellarWalletsKit {
  if (_kit) return _kit;
  const network =
    process.env.TRUSTLESS_WORK_NETWORK === "mainnet"
      ? WalletNetwork.PUBLIC
      : WalletNetwork.TESTNET;

  try {
    _kit = new StellarWalletsKit({
      network,
      selectedWalletId: FREIGHTER_ID,
      modules: [new FreighterModule(), new AlbedoModule(), new xBullModule(), new HanaModule()],
    });
  } catch {
    // Some module constructors require browser globals; fall back to allowAll
    // which lazy-resolves modules at open time.
    _kit = new StellarWalletsKit({
      network,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return _kit;
}

export interface SignedXdrResult {
  signedXdr: string;
  address: string;
}

export async function signXdrWithWallet(unsignedXdr: string): Promise<SignedXdrResult> {
  const kit = getWalletKit();
  const { address } = await kit.getAddress();
  const { signedTxXdr } = await kit.signTransaction(unsignedXdr, { address });
  return { signedXdr: signedTxXdr, address };
}
