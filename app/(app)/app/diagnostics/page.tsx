import { Topbar } from "@/components/shell/topbar";
import { DiagnosticsBoard } from "@/components/diagnostics/diagnostics-board";

export const metadata = {
  title: "Diagnostics · Sunvasi",
};

export default function DiagnosticsPage() {
  return (
    <>
      <Topbar label="Diagnostics" />
      <div className="flex-1 mx-auto w-full max-w-[1100px] px-6 lg:px-10 py-10 lg:py-14">
        <header className="mb-10">
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">
            Integration diagnostics
          </h1>
          <p className="mt-3 text-body text-fg-muted max-w-[60ch]">
            What&apos;s wired, what&apos;s reachable, what&apos;s falling back to mock mode.
            Useful before a demo. Also useful when something starts failing and you want to
            isolate which dependency.
          </p>
        </header>
        <DiagnosticsBoard />
      </div>
    </>
  );
}
