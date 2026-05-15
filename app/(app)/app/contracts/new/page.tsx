import { Topbar } from "@/components/shell/topbar";
import { StepperCreate } from "@/components/contract/stepper-create";

export default function NewContractPage() {
  return (
    <>
      <Topbar label="New contract" />
      <div className="flex-1 mx-auto w-full max-w-[1100px] px-6 lg:px-10 py-10 lg:py-14">
        <header className="mb-10">
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">
            Compose a new contract.
          </h1>
          <p className="mt-3 text-body text-fg-muted max-w-[55ch]">
            Four steps. Don&apos;t worry about being perfect — you can edit before sending.
          </p>
        </header>
        <StepperCreate />
      </div>
    </>
  );
}
