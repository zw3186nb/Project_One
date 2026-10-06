import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { avatarUrl, displayName, requireCompleteProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Members | Project One" };

type Joke = { id: number; setup: string; punchline: string; category: string };

/** Picks one joke for the member; null if the table cannot be read. */
async function pickJoke(): Promise<Joke | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("jokes").select("id, setup, punchline, category");
  if (!data?.length) return null;
  return data[Math.floor(Math.random() * data.length)];
}

/**
 * Protected route: proxy.ts redirects signed-out visitors to /login, and
 * requireCompleteProfile() checks again here, right next to the data.
 */
export default async function MembersPage() {
  const { profile } = await requireCompleteProfile();
  const joke = await pickJoke();
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="flex-1 px-6 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          Members only · You are signed in
        </p>

        <div className="mt-5 flex items-center gap-5">
          <Avatar src={avatarUrl(profile.avatar_path)} name={displayName(profile)} size={72} />
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Hi, {profile.first_name}.
            </h1>
            <p className="mt-2 text-white/60">
              {displayName(profile)}
              {memberSince && ` · member since ${memberSince}`}
            </p>
          </div>
        </div>

        <p className="mt-8 text-white/60">
          This page only exists for signed-in members. Open it in a private window and you will be
          sent to the sign-in page instead.
        </p>

        {joke && (
          <section className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 font-mono text-xs">
              <span className="uppercase tracking-[0.2em] text-amber-200/90">
                Your joke for this visit
              </span>
              <span className="text-white/40">{joke.category}</span>
            </div>
            <p className="mt-4 text-xl leading-snug">{joke.setup}</p>
            <p className="mt-2 text-white/65">{joke.punchline}</p>
            <p className="mt-5 text-xs text-white/40">Refresh for another one.</p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/profile"
            className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
          >
            Edit your profile
          </Link>
          <Link
            href="/jokes"
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/35"
          >
            See all jokes
          </Link>
        </div>
      </div>
    </main>
  );
}
