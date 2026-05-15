"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  // Login methods are gated by the Privy dashboard. Until you enable Google
  // OAuth there ("User Management → Authentication methods → Google"), keep
  // it out of the list so the SDK doesn't error on attempted Google sign-in.
  const enableGoogle = process.env.NEXT_PUBLIC_PRIVY_GOOGLE_LOGIN === "true";
  const enableWalletLogin = process.env.NEXT_PUBLIC_PRIVY_WALLET_LOGIN === "true";
  const loginMethods: ("email" | "google" | "wallet")[] = ["email"];
  if (enableGoogle) loginMethods.push("google");
  if (enableWalletLogin) loginMethods.push("wallet");

  const tree = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            className:
              "!bg-bg-elevated !text-fg !border !border-border !rounded !font-sans",
            duration: 4500,
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );

  // Privy requires an app ID at runtime. During scaffolding without an ID we
  // render the tree without the provider so the app still boots; auth-aware
  // pages render their "not configured" state.
  if (!privyAppId) return tree;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods,
        appearance: {
          theme: "dark",
          accentColor: "#D97757",
          showWalletLoginFirst: false,
          logo: undefined,
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      {tree}
    </PrivyProvider>
  );
}
