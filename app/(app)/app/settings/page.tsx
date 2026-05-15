import { Topbar } from "@/components/shell/topbar";
import { ThemeSwitcher } from "@/components/shell/theme-switcher";

export default function SettingsPage() {
  return (
    <>
      <Topbar label="Settings" />
      <div className="flex-1 mx-auto w-full max-w-[860px] px-6 lg:px-10 py-10 lg:py-14 space-y-10">
        <header>
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">Settings</h1>
          <p className="mt-2 text-body-sm text-fg-muted">Preferences for your Sunvasi account.</p>
        </header>

        <section className="rounded-lg border border-border bg-bg-elevated p-6 lg:p-8 space-y-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Theme</p>
              <p className="mt-1 text-body-sm text-fg">Sunvasi is designed dark-first; light is also good.</p>
            </div>
            <ThemeSwitcher />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-bg-elevated p-6 lg:p-8 space-y-5">
          <header>
            <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Notifications</p>
            <p className="mt-1 text-body-sm text-fg-muted">Email you when things happen.</p>
          </header>
          <CheckboxRow label="Milestone approved" defaultChecked />
          <CheckboxRow label="Milestone disputed" defaultChecked />
          <CheckboxRow label="Funds released" defaultChecked />
          <CheckboxRow label="Auto-release reminder (24h before)" />
        </section>

        <section className="rounded-lg border border-border bg-bg-elevated p-6 lg:p-8 space-y-3">
          <p className="text-caption uppercase tracking-[0.16em] text-fg-subtle">Connected accounts</p>
          <p className="text-body-sm text-fg-muted">
            Manage your Privy-linked methods (email, Google, wallet) from the Privy hosted dashboard.
          </p>
        </section>
      </div>
    </>
  );
}

function CheckboxRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 text-body-sm text-fg cursor-pointer">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-border bg-bg accent-[var(--accent)]"
      />
      <span>{label}</span>
    </label>
  );
}
