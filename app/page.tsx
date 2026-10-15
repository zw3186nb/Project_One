import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { TopPhotographers } from "@/components/top-photographers";
import { VoiceScoreboard } from "@/components/voice-scoreboard";
import { getSession } from "@/lib/auth";
import { todaysTheme } from "@/lib/daily";
import { getFeed, getVoiceScores, hasVotedOn, parseSort, topPhotographers, type Sort } from "@/lib/feed";

const SORTS: { key: Sort; label: string }[] = [
  { key: "hot", label: "Hot" },
  { key: "new", label: "New" },
  { key: "top", label: "Top" },
];

const STEPS = [
  { n: "1", title: "Snap", text: "Post a photo from campus or the city." },
  { n: "2", title: "Three takes", text: "AI reads the scene and roasts it in three voices." },
  { n: "3", title: "Judge", text: "Vote for the funniest. The crowd crowns a winner." },
];

/** The feed: every photo, its three AI takes, and the votes. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sort = parseSort((await searchParams).sort);
  const session = await getSession();
  const viewerId = session?.user.id ?? null;
  const theme = todaysTheme();

  const [{ posts, error }, scores] = await Promise.all([getFeed(sort, viewerId), getVoiceScores()]);
  const waiting = viewerId
    ? posts.filter((p) => !hasVotedOn(p) && p.user_id !== viewerId).length
    : posts.length;

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        {/* ── Intro: what this is, and the one thing to do next ── */}
        <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-stretch">
          <div className="flex flex-col justify-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
              One photo · three voices · you pick the winner
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Three Takes</h1>
            <p className="mt-3 max-w-xl text-white/60">
              A polite Midwesterner, a jaded New Yorker and someone far too online all caption the same photo.
              You decide who&apos;s funniest.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/play"
                className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
              >
                {viewerId && waiting > 0
                  ? `Judge ${waiting} new ${waiting === 1 ? "photo" : "photos"} →`
                  : "Start judging →"}
              </Link>
              <Link
                href={session ? "/create" : "/login"}
                className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/45"
              >
                {session ? "Post a photo" : "Sign in to post"}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 sm:p-5">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200/90">
              {theme.weekday}&apos;s prompt
            </h2>
            <p className="mt-2 text-xl font-semibold">{theme.title}</p>
            <p className="mt-1 hidden text-sm text-white/60 sm:block">{theme.hint}</p>
            <Link
              href={session ? "/create?prompt=today" : "/login"}
              className="mt-3 inline-block text-sm font-semibold text-amber-300 hover:text-amber-200"
            >
              {session ? "Take the prompt →" : "Sign in to take the prompt →"}
            </Link>
          </div>
        </section>

        {/* New visitors get the three-step explainer; members already know the drill. */}
        {!session && (
          <ol className="mt-6 grid gap-2 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-xs text-white/80">
                  {step.n}
                </span>
                <span className="text-sm">
                  <span className="font-semibold text-white">{step.title}.</span>{" "}
                  <span className="text-white/55">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        )}

        {/* ── Feed + sidebar ── */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Posts">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Feed</h2>
              <nav aria-label="Sort posts" className="flex items-center gap-1.5">
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
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-5">
                <p className="font-medium text-red-200">Could not load posts.</p>
                <p className="mt-2 font-mono text-sm text-red-200/80">{error}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-10 text-center">
                <p className="text-lg font-semibold">No posts yet.</p>
                <p className="mt-2 text-sm text-white/55">
                  Be the first. Today&apos;s prompt is {theme.title.toLowerCase()}.
                </p>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-6">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} viewerId={viewerId} />
                ))}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
            <VoiceScoreboard scores={scores} />
            <TopPhotographers people={topPhotographers(posts)} />
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
