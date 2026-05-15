import Link from "next/link";
import { Wordmark } from "./wordmark";

const COLS: { heading: string; items: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    items: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Arbitration", href: "/arbitration" },
      { label: "Try the demo", href: "/app/contracts/DEMOH3LX/arbitration" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Manifesto", href: "/how-it-works#manifesto" },
      { label: "Corridor", href: "/#corridor" },
      { label: "Contact", href: "mailto:hello@sunvasi.com" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Open source", href: "https://github.com/sunvasi" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border mt-32">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <Wordmark size="md" />
            <p className="mt-4 text-body-sm text-fg-muted max-w-xs">
              Milestone-based escrow for cross-border freelance work. Funds held in USDC,
              released by agreement.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.heading}>
              <h4 className="text-caption uppercase tracking-[0.16em] text-fg-subtle mb-3">
                {c.heading}
              </h4>
              <ul className="space-y-2">
                {c.items.map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="text-body-sm text-fg-muted hover:text-fg transition-colors"
                    >
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="hairline mt-12 mb-6" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
            © {new Date().getFullYear()} · Sunvasi · Made for the corridor.
          </p>
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
            Stellar · USDC · Trustless Work
          </p>
        </div>
      </div>
    </footer>
  );
}
