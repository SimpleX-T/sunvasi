"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

/* ---------------------------------------------------------------------------
 * Authenticated fetch hook. Attaches the Privy id-token as a bearer header so
 * our /api/* routes can identify the user via `readUserFromHeaders`.
 * Falls through to a plain fetch when Privy isn't configured.
 * ------------------------------------------------------------------------ */

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export function useAuthedFetch(): (input: string, init?: RequestInit) => Promise<Response> {
  // Always call the hook, then no-op if not configured.
  const privy = PRIVY_CONFIGURED ? usePrivy() : null;

  return useCallback(
    async (input: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (privy?.authenticated && privy.getAccessToken) {
        try {
          const token = await privy.getAccessToken();
          if (token) headers.set("Authorization", `Bearer ${token}`);
        } catch {
          // proceed unauthenticated
        }
      }
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers });
    },
    [privy],
  );
}
