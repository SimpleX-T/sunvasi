import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile().catch(() => null);
  return (
    <div className="flex min-h-svh w-full">
      <Sidebar
        email={profile?.email}
        displayName={profile?.display_name}
        avatarUrl={profile?.avatar_url}
      />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      <CommandPalette />
      <OnboardingGate />
    </div>
  );
}
