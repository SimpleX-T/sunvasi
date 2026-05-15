import { Hero } from "@/components/marketing/hero";
import { SectionProblem } from "@/components/marketing/section-problem";
import { SectionHow } from "@/components/marketing/section-how";
import { SectionArbitrator } from "@/components/marketing/section-arbitrator";
import { SectionCorridor } from "@/components/marketing/section-corridor";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SectionProblem />
      <SectionHow />
      <SectionArbitrator />
      <SectionCorridor />
    </>
  );
}
