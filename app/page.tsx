import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { VoiceScoreboard } from "@/components/voice-scoreboard";
import { getSession } from "@/lib/auth";
import { todaysTheme } from "@/lib/daily";
import { getFeed, getVoiceScores, parseSort, type Sort } from "@/lib/feed";

const SORTS: { key: Sort; label: string }[] = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
];

/** The feed: every photo, its three AI takes, and the votes. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sort = parseSort((await searchParams).sort);
  const session = await getSession();
  const viewerId = session?.user.id ?? null;
  const theme = todaysTheme();

  const [{ posts, error }, scores] = await Promise.all([getFeed(sort, viewerId), getVoiceScores()]);

  return (
    <main className="flex-1 px-6 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-5xl">
        <header className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
            One photo · three voices · you pick the winner
          </p>
          <h1 className="mt-3 bg-linear-to-b from-white to-white/60 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
            Three Takes
          </h1>
          <p className="mt-4 text-white/60">
            Post a photo from campus or the city. AI captions it as a polite Midwesterner, a jaded
            New Yorker, and someone who is far too online. Vote for the take that gets it right.
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Posts" className="order-2 lg:order-1">
            <nav aria-label="Sort posts" className="flex items-center gap-2">
              {SORTS.map(({ key, label }) => (
                <Link
                  key={key}
                  href={key === "hot" ? "/" : `/?sort=${key}`}
                  aria-current={sort === key ? "page" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    sort === key
                      ? "border-white bg-white font-semibold text-black"
                      : "border-white/15 text-white/65 hover:border-white/35 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-5">
                <p className="font-medium text-red-200">Could not load posts.</p>
                <p className="mt-2 font-mono text-sm text-red-200/80">{error}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center">
                <p className="text-lg font-semibold">No posts yet.</p>
                <p className="mt-2 text-sm text-white/55">
                  Be the first. Today&apos;s prompt is {theme.title.toLowerCase()}.
                </p>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-6">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} viewerId={viewerId} />
                ))}
              </div>
            )}
          </section>

          <aside className="order-1 flex flex-col gap-5 lg:order-2">
            <section className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-5">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200/90">
                {theme.weekday}&apos;s prompt
              </h2>
              <p className="mt-2 text-xl font-semibold">{theme.title}</p>
              <p className="mt-1 text-sm text-white/60">{theme.hint}</p>
              <Link
                href={session ? "/create" : "/login"}
                className="mt-4 inline-block rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
              >
                {session ? "Post a photo →" : "Sign in to post →"}
              </Link>
            </section>

            <VoiceScoreboard scores={scores} />

            {!session && (
              <p className="px-1 text-xs text-white/40">
                Anyone can read the feed. Sign in with Google to post photos and vote.
              </p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
