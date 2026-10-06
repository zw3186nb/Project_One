import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getSession, hasName } from "@/lib/auth";

export const metadata = { title: "Sign in | Project One" };

// Fixed messages, so nothing from the URL is ever shown as-is.
const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled or the link expired. Please try again.",
  exchange: "Google sign-in could not be completed. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await getSession();
  if (session) redirect(hasName(session.profile) ? "/members" : "/onboarding");

  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          Members only
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-white/60">
          Use your Google account to open the members area and your profile.
        </p>

        {message && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
          >
            {message}
          </p>
        )}

        <div className="mt-6">
          <GoogleSignInButton />
        </div>

        <p className="mt-5 text-xs text-white/40">
          The first time you sign in, a profile is created for you automatically.
        </p>
      </div>
    </main>
  );
}
