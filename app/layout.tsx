import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

/* ---------------------------------------------------------------------------
 * Fonts
 *   Display:  Fraunces (variable, opsz+wght axes)
 *   Body/UI:  Manrope — temporary Switzer substitute. See public/fonts/README.
 *   Mono:     JetBrains Mono
 * ------------------------------------------------------------------------ */

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Sunvasi — Contracts that pay themselves",
    template: "%s · Sunvasi",
  },
  description:
    "A milestone-based escrow platform for cross-border freelance work. Funds are held in USDC, released by agreement, and arbitrated by an AI when you don't agree.",
  applicationName: "Sunvasi",
  authors: [{ name: "Sunvasi" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    title: "Sunvasi — Contracts that pay themselves",
    description:
      "Milestone-based escrow for cross-border freelance work, with AI-arbitrated disputes.",
    siteName: "Sunvasi",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sunvasi",
    description:
      "Milestone-based escrow for cross-border freelance work, with AI-arbitrated disputes.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0A09" },
    { media: "(prefers-color-scheme: light)", color: "#F5F1E8" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Theme bootstrap — read from localStorage before hydration to avoid flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sunvasi-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else if(t==='system'||!t){var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light')}}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased text-fg bg-bg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
