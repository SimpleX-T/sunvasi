import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Sunvasi escrows freelance work: parties, lifecycle, milestones, auto-release, and AI-arbitrated disputes.",
};

const SECTIONS = [
  { id: "parties", n: "01", title: "The parties" },
  { id: "lifecycle", n: "02", title: "The lifecycle" },
  { id: "milestones", n: "03", title: "Milestones" },
  { id: "release", n: "04", title: "Auto-release" },
  { id: "disputes", n: "05", title: "Disputes" },
  { id: "trust", n: "06", title: "Why this is trustless" },
];

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-[1280px] px-6 lg:px-10 pt-16 lg:pt-24 pb-24">
      <header className="border-b border-border pb-12">
        <p className="eyebrow">A manifesto, in six parts</p>
        <h1 className="mt-6 font-display text-display-2xl text-fg tracking-[-0.025em] leading-[0.96]">
          How Sunvasi works.
        </h1>
        <p className="mt-6 max-w-[60ch] text-body-lg text-fg-muted leading-[1.55]">
          A field guide for the freelancer in Lagos and the client in Berlin. Read it
          straight through, or jump to a section.
        </p>
      </header>

      <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-20 mt-16">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-3">
            <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">In this page</p>
            <ul className="space-y-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`#${s.id}`}
                    className="text-body-sm text-fg-muted hover:text-fg transition-colors flex items-baseline gap-3"
                  >
                    <span className="font-mono text-mono-sm text-fg-subtle">{s.n}</span>
                    <span>{s.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="space-y-20 max-w-prose">
          <Section id="parties" n="01" title="The parties">
            <p>
              Every Sunvasi contract is between two human parties and three on-chain roles
              you don&apos;t have to think about. The two humans are the <strong>Client</strong> and
              the <strong>Freelancer</strong>. The three on-chain roles are the{" "}
              <strong>Approver</strong>, the <strong>Release Signer</strong>, and the{" "}
              <strong>Dispute Resolver</strong>.
            </p>
            <p>
              By default the Client is the Approver and the Release Signer (they say
              &ldquo;done&rdquo; and the funds go). The Dispute Resolver is Sunvasi&apos;s arbitrator
              — invoked only when the parties disagree, and constrained by the rules
              published on the <Link href="/arbitration" className="underline hover:text-fg">arbitration page</Link>.
            </p>
          </Section>

          <Section id="lifecycle" n="02" title="The lifecycle">
            <ol className="list-none space-y-3 font-mono text-mono-sm text-fg-muted pl-0">
              <li>DRAFT — &nbsp; you compose the contract.</li>
              <li>AWAITING FUNDING — &nbsp; the client receives the link.</li>
              <li>ACTIVE — &nbsp; funds are held in escrow on Stellar.</li>
              <li>COMPLETED — &nbsp; every milestone released.</li>
              <li>DISPUTED — &nbsp; the arbitrator is reviewing.</li>
              <li>RESOLVED — &nbsp; verdict applied, funds distributed.</li>
            </ol>
          </Section>

          <Section id="milestones" n="03" title="Milestones">
            <p>
              A contract is a list of milestones. Each milestone has a title, a description,
              acceptance criteria, and an amount. The sum of milestones is the total budget;
              you can&apos;t fund the contract until they add up.
            </p>
            <p>
              When the freelancer submits a milestone — files, links, a note — the milestone
              enters <strong>submitted</strong>. The client has the auto-release window (default
              seven days) to approve, request changes, or open a dispute.
            </p>
          </Section>

          <Section id="release" n="04" title="Auto-release">
            <p>
              Once a milestone is submitted, a countdown begins. If the client approves
              before the countdown ends, funds release immediately. If the countdown ends
              without action, funds release automatically. The default window is seven
              days; the freelancer sets the range (3–14 days) at contract creation and the
              client agrees by funding.
            </p>
            <p>
              Auto-release is the most important feature of the system, because it removes
              the ghosting failure mode. A client who simply disappears does not strand the
              freelancer&apos;s payment.
            </p>
          </Section>

          <Section id="disputes" n="05" title="Disputes">
            <p>
              Either party can dispute a submitted milestone. The dispute form asks three
              structured questions — what was promised, what was delivered, what&apos;s the gap —
              and accepts file uploads. The other side gets a parallel form.
            </p>
            <p>
              The AI arbitrator then runs. It can ask one clarifying question of each party.
              It produces a transparent verdict — release X% to the freelancer, refund the
              rest — with reasoning a non-lawyer can read in under ninety seconds. If
              confidence is &ldquo;insufficient,&rdquo; no funds move and the dispute
              escalates to a human reviewer.
            </p>
            <p>
              The verdict is signed on-chain by the Dispute Resolver and the milestone
              splits accordingly.
            </p>
          </Section>

          <Section id="trust" n="06" title="Why this is trustless">
            <p>
              Sunvasi never holds the funds. The escrow is a non-custodial Stellar smart
              contract from <a className="underline hover:text-fg" href="https://www.trustlesswork.com">Trustless Work</a>.
              You can inspect the state of any contract via the Escrow Viewer link on its
              page. The rules the arbitrator follows are published on the{" "}
              <Link href="/arbitration" className="underline hover:text-fg inline-flex items-center gap-1">
                arbitration page <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>{" "}
              and version-hashed into every verdict, so old decisions remain reproducible.
            </p>
            <p>
              When the system is in full agreement, no human at Sunvasi is in the loop. When
              the system requires a tie-break, the tie-breaker&apos;s rules are publicly
              auditable. That is what we mean by trustless.
            </p>
          </Section>
        </div>
      </div>
    </article>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32">
      <p className="font-mono text-mono-sm text-fg-subtle uppercase tracking-[0.16em]">
        {n} — {title}
      </p>
      <h2 className="mt-3 font-display text-display-lg text-fg tracking-[-0.02em] leading-[1.05]">
        {title}.
      </h2>
      <div className="mt-6 prose-editorial">{children}</div>
    </section>
  );
}
