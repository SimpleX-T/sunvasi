export function SectionProblem() {
  return (
    <section className="relative border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 items-start">
          <div>
            <p className="eyebrow">02 — The problem</p>
            <blockquote className="mt-10 font-display text-display-lg text-fg leading-[1.05] tracking-tight max-w-[20ch]">
              &ldquo;Two months ago, My account got banned. Why? I don't
              know.&rdquo;
            </blockquote>
            <cite className="not-italic mt-6 block text-caption uppercase tracking-[0.16em] text-fg-subtle font-mono">
              — Anonymous Lagos developer, March 2026
            </cite>
          </div>

          <div className="space-y-6 prose-editorial">
            <p>
              <strong>Trust runs in one direction.</strong> A client in Berlin
              has no signal that the freelancer in Lagos will deliver. A
              freelancer in Lagos has no signal that the client will pay.
              Platforms in the middle take 15% and freeze accounts when
              something looks off.
            </p>
            <p>
              <strong>The wire is slower than the deadline.</strong> Bank
              transfers from abroad take three to seven days. They lose another
              five to ten percent to FX. Payments arrive after the work is
              finished and before the next month&apos;s rent.
            </p>
            <p>
              <strong>The currency loses value as the email waits.</strong> The
              Naira moved six percent in a single month last spring. A delay
              isn&apos;t just a delay — it&apos;s a haircut.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
