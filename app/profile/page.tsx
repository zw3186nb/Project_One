import { updateProfile } from "@/app/actions";
import { AvatarUploader } from "@/components/avatar-uploader";
import { NameForm } from "@/components/name-form";
import { avatarUrl, displayName, requireCompleteProfile } from "@/lib/auth";

export const metadata = { title: "Profile | Three Takes" };

export default async function ProfilePage() {
  const { user, profile } = await requireCompleteProfile();

  return (
    <main className="flex-1 px-6 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          Your account
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Profile</h1>
        <p className="mt-3 text-white/60">
          Signed in as <span className="text-white/85">{profile.email ?? user.email}</span>.
        </p>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Photo</h2>
          <p className="mt-1 text-sm text-white/50">
            Stored in Supabase Storage. The database only keeps the file&apos;s path.
          </p>
          <div className="mt-5">
            <AvatarUploader
              userId={user.id}
              currentUrl={avatarUrl(profile.avatar_path)}
              name={displayName(profile)}
            />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Name</h2>
          <div className="mt-5">
            <NameForm
              action={updateProfile}
              firstName={profile.first_name ?? ""}
              lastName={profile.last_name ?? ""}
              submitLabel="Save changes"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
