import { redirect } from "next/navigation";
import { completeOnboarding } from "@/app/actions";
import { NameForm } from "@/components/name-form";
import { hasName, requireUser } from "@/lib/auth";

export const metadata = { title: "Welcome | Three Takes" };

/** Shown after login when the profile has no first or last name yet. */
export default async function OnboardingPage() {
  const { profile } = await requireUser();
  if (hasName(profile)) redirect("/members");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          One more step
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">What should we call you?</h1>
        <p className="mt-2 text-sm text-white/60">
          You are signed in as <span className="text-white/85">{profile.email}</span>. Add your
          first and last name to finish setting up your profile. You can change them later.
        </p>

        <div className="mt-6">
          <NameForm
            action={completeOnboarding}
            firstName={profile.first_name ?? ""}
            lastName={profile.last_name ?? ""}
            submitLabel="Save and continue"
          />
        </div>
      </div>
    </main>
  );
}
