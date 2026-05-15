import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SectionArbitrator() {
  return (
    <section className="relative border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-end">
          <div>
            <p className="eyebrow">04 — The arbitrator</p>
            <h2 className="mt-8 font-display text-display-xl text-fg leading-[1.0] tracking-[-0.02em]">
              When agreements break,
              <br />
              <span className="text-fg-muted">fairness shouldn&apos;t take weeks.</span>
            </h2>
          </div>

          <div className="space-y-6 prose-editorial">
            <p>
              An AI reads the contract, the acceptance criteria, the evidence each side
              submits, and the working history. It can ask one clarifying question of each
              party. It produces a transparent verdict — release this percentage to the
              freelancer, refund the rest — with reasoning a non-lawyer can read in under
              ninety seconds.
            </p>
            <p>
              The verdict is signed and final unless confidence is &ldquo;insufficient,&rdquo;
              in which case no funds move and the dispute escalates to a human reviewer.
            </p>
            <p className="pt-2">
              <Link
                href="/arbitration"
                className="inline-flex items-center gap-1.5 text-fg hover:text-accent transition-colors duration-150 ease-sunvasi border-b border-border hover:border-accent pb-0.5"
              >
                Read the arbitrator&apos;s constitution
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
