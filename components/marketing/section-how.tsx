const STEPS = [
  {
    n: "01",
    title: "Create the contract.",
    body: "Title, milestones, acceptance criteria, amounts. Sunvasi types it like a printed agreement.",
  },
  {
    n: "02",
    title: "Client funds in one click.",
    body: "A public link, an email auth, a card payment. Funds land in a non-custodial escrow on Stellar.",
  },
  {
    n: "03",
    title: "You work. You deliver.",
    body: "Upload files, paste links, write notes. Each milestone is a small contract of its own.",
  },
  {
    n: "04",
    title: "Funds release on approval.",
    body: "The client approves, the milestone releases. Or it auto-releases after the agreed window.",
  },
  {
    n: "05",
    title: "Disputes resolved in 60 seconds.",
    body: "An AI arbitrator reviews the evidence, both sides, and the acceptance criteria. Partial verdicts are normal.",
  },
];

export function SectionHow() {
  return (
    <section className="relative border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[0.35fr_1fr] gap-10 lg:gap-20">
          <div>
            <p className="eyebrow">03 — How it works</p>
            <h2 className="mt-8 font-display text-display-lg text-fg leading-[1.05] tracking-tight">
              Five steps. No mystery.
            </h2>
          </div>
          <ol className="space-y-12">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-[80px_1fr] gap-6 items-baseline border-t border-border pt-6 first:border-t-0 first:pt-0"
              >
                <span className="font-display text-display-md text-fg-subtle font-light">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-display text-display-sm text-fg tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-body text-fg-muted max-w-[52ch] leading-[1.55]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
