import { Topbar } from "@/components/shell/topbar";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentProfile } from "@/lib/auth";

export default async function ProfilePage() {
  const profile = await getCurrentProfile().catch(() => null);
  return (
    <>
      <Topbar label="Profile" />
      <div className="flex-1 mx-auto w-full max-w-[860px] px-6 lg:px-10 py-10 lg:py-14">
        <header className="mb-10">
          <h1 className="font-display text-display-lg text-fg tracking-[-0.02em]">Your profile</h1>
          <p className="mt-2 text-body-sm text-fg-muted">
            What clients see when you send them a contract link.
          </p>
        </header>

        {profile ? (
          <ProfileForm profile={profile} />
        ) : (
          <div className="rounded-lg border border-border bg-bg-elevated p-10 text-center">
            <p className="font-display text-display-md text-fg-muted tracking-tight">
              Sign in to manage your profile.
            </p>
            <p className="mt-3 text-body-sm text-fg-subtle max-w-[40ch] mx-auto">
              Your profile is created automatically the first time you sign in. Then this page becomes editable.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
