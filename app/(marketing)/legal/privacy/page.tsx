import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Sunvasi handles your data.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[820px] px-6 lg:px-10 pt-16 lg:pt-24 pb-24">
      <header className="border-b border-border pb-12">
        <p className="eyebrow">Privacy</p>
        <h1 className="mt-6 font-display text-display-2xl text-fg tracking-[-0.025em] leading-[0.96]">
          Privacy Policy
        </h1>
        <p className="mt-4 font-mono text-mono-sm text-fg-subtle">Last updated · {new Date().getFullYear()}</p>
      </header>

      <div className="prose-editorial mt-12 space-y-10 text-fg-muted">
        <Section n="01" title="What we collect">
          <p>
            <strong>Identity:</strong> email address (via Privy), display name, optional avatar.
          </p>
          <p>
            <strong>Profile data you provide:</strong> bio, skills, country, hourly rate, portfolio
            links.
          </p>
          <p>
            <strong>Contract data:</strong> titles, descriptions, milestones, acceptance criteria,
            amounts, deliverable files and links, dispute evidence.
          </p>
          <p>
            <strong>On-chain:</strong> your Stellar wallet address (public), escrow transaction
            hashes (public).
          </p>
        </Section>

        <Section n="02" title="What we don't collect">
          <p>
            We never see or store private keys. Privy holds your embedded wallet credentials with
            no Sunvasi access. We do not track you across other sites.
          </p>
        </Section>

        <Section n="03" title="Who sees what">
          <p>
            Your <strong>profile</strong> is visible to the people you invite via funding links.
          </p>
          <p>
            Your <strong>contracts and milestones</strong> are visible to the freelancer, the
            client, and the AI arbitrator (only if a dispute is filed).
          </p>
          <p>
            On-chain data (your wallet address, escrow contract address, transaction hashes) is
            globally visible on the Stellar network — that&apos;s how non-custodial escrows work.
          </p>
        </Section>

        <Section n="04" title="Third parties">
          <p>
            We use: <strong>Supabase</strong> (database + storage),{" "}
            <strong>Privy</strong> (auth + wallets), <strong>Cloudinary</strong> (file uploads),{" "}
            <strong>Google Gemini</strong> (AI arbitration), <strong>Resend</strong> (transactional
            email), <strong>Trustless Work</strong> (escrow infrastructure),{" "}
            <strong>Stellar</strong> (settlement layer).
          </p>
          <p>
            Each provider has its own privacy policy. We share with them only what they need to
            provide their service.
          </p>
        </Section>

        <Section n="05" title="Retention">
          <p>
            Profile + contract data lives until you delete it (or, for funded contracts, until the
            escrow is resolved on-chain — then we retain a record of the verdict for auditability).
          </p>
          <p>
            Disputes and AI arbitration tool-call logs are retained indefinitely so both parties can
            audit decisions.
          </p>
        </Section>

        <Section n="06" title="Your rights">
          <p>
            You can edit your profile, delete unfunded contracts, and request export or deletion of
            your data by emailing{" "}
            <a href="mailto:privacy@sunvasi.app" className="underline hover:text-fg">
              privacy@sunvasi.app
            </a>
            . On-chain records cannot be erased.
          </p>
        </Section>

        <Section n="07" title="Contact">
          <p>
            Privacy questions: <a href="mailto:privacy@sunvasi.app" className="underline hover:text-fg">privacy@sunvasi.app</a>.
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
