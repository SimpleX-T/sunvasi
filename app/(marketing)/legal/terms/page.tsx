import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Sunvasi's terms of service.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[820px] px-6 lg:px-10 pt-16 lg:pt-24 pb-24">
      <header className="border-b border-border pb-12">
        <p className="eyebrow">The fine print</p>
        <h1 className="mt-6 font-display text-display-2xl text-fg tracking-[-0.025em] leading-[0.96]">
          Terms of Service
        </h1>
        <p className="mt-4 font-mono text-mono-sm text-fg-subtle">Last updated · {new Date().getFullYear()}</p>
      </header>

      <div className="prose-editorial mt-12 space-y-10 text-fg-muted">
        <Section n="01" title="What Sunvasi is">
          <p>
            Sunvasi is an application layer over Trustless Work, a non-custodial milestone escrow
            primitive on Stellar/Soroban. We don&apos;t hold your funds. Funds are held by a smart
            contract until you and the other party agree to release them — or until the AI
            arbitrator decides on your behalf according to the public rules at{" "}
            <a href="/arbitration" className="underline hover:text-fg">/arbitration</a>.
          </p>
        </Section>

        <Section n="02" title="Who can use Sunvasi">
          <p>
            You must be at least 18 years old and capable of forming a binding contract under your
            local law. You agree not to use Sunvasi for unlawful work or to launder funds.
          </p>
        </Section>

        <Section n="03" title="Your account">
          <p>
            Sunvasi uses Privy for authentication. Your identity is your email address. Sunvasi
            never sees or stores your wallet&apos;s private keys.
          </p>
        </Section>

        <Section n="04" title="Disputes and arbitration">
          <p>
            Disputes between a freelancer and client over a milestone are resolved by the Sunvasi
            Arbitrator, whose full system prompt and tools are public at{" "}
            <a href="/arbitration" className="underline hover:text-fg">/arbitration</a>. Verdicts
            are recorded with a version hash so historical decisions remain reproducible.
          </p>
          <p>
            When the arbitrator&apos;s confidence is &ldquo;insufficient&rdquo; no funds move
            automatically — the dispute escalates to a human reviewer.
          </p>
        </Section>

        <Section n="05" title="Fees">
          <p>
            During the beta there is no platform fee. We will give 30 days&apos; notice before
            introducing one. Stellar network fees for on-chain operations are paid out of escrow.
          </p>
        </Section>

        <Section n="06" title="No financial advice">
          <p>
            Sunvasi is a tool, not a fiduciary. Nothing on this site is investment, legal, or tax
            advice. USDC is a third-party stablecoin; we make no warranties about its value or its
            issuer.
          </p>
        </Section>

        <Section n="07" title="Liability">
          <p>
            Sunvasi is provided &ldquo;as is&rdquo;. To the maximum extent permitted by law, we
            disclaim all warranties and liabilities for losses arising from on-chain failures,
            counterparty conduct, or your own errors.
          </p>
        </Section>

        <Section n="08" title="Contact">
          <p>
            Questions about these terms: <a href="mailto:hello@sunvasi.app" className="underline hover:text-fg">hello@sunvasi.app</a>.
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="font-mono text-mono-sm uppercase tracking-[0.16em] text-fg-subtle">
        {n} — {title}
      </p>
      <h2 className="mt-3 font-display text-display-md text-fg tracking-tight">{title}.</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
