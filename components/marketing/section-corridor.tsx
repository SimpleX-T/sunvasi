export function SectionCorridor() {
  return (
    <section id="corridor" className="relative border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-[0.35fr_1fr] gap-10 lg:gap-20">
          <div>
            <p className="eyebrow">05 — Built for the corridor</p>
          </div>
          <div className="space-y-6">
            <h2 className="font-display text-display-xl text-fg leading-[1.0] tracking-[-0.02em] max-w-[20ch]">
              We started where the trust problem is most expensive.
            </h2>
            <div className="prose-editorial mt-6 max-w-[60ch]">
              <p>
                Sunvasi is built first for Nigerian freelancers and their foreign clients —
                the corridor where a delayed wire becomes a real loss in real currency.
                Everything in the product is designed so that neither side has to notice
                they&apos;re using crypto. A client pays with a card and a confirmation email.
                A freelancer cashes out to Naira via Yellow Card.
              </p>
              <p>
                If it works here, it works everywhere. But here is where it has to work first.
              </p>
            </div>
            <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-mono-sm text-fg-subtle">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" /> Lagos · Abuja · Port Harcourt
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" /> Off-ramp: Yellow Card · Onboard · Busha
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-accent" /> Settlement in ~5 seconds
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
