import Link from "next/link";
import { VoteButtons } from "@/components/vote-buttons";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Fetch from Supabase on every request, so the page always shows
// what is in the table right now (not a snapshot taken at build time).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Jokes | Three Takes",
};

type Joke = {
  id: number;
  setup: string;
  punchline: string;
  category: string;
  upvotes: number;
  downvotes: number;
  /** The signed-in viewer's own vote: 1, -1 or 0. */
  myVote: number;
};

async function loadJokes(viewerId: string | null): Promise<{ jokes: Joke[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jokes")
      .select("id, setup, punchline, category, upvotes, downvotes")
      .order("id", { ascending: true });
    if (error) return { jokes: [], error: error.message };

    // Row Level Security only ever returns the viewer's own votes.
    const myVotes = new Map<number, number>();
    if (viewerId) {
      const { data: votes } = await supabase.from("joke_votes").select("joke_id, vote");
      for (const vote of votes ?? []) myVotes.set(vote.joke_id, vote.vote);
    }

    const jokes = (data ?? []).map((joke) => ({ ...joke, myVote: myVotes.get(joke.id) ?? 0 }));
    // Best-rated first; untouched jokes keep their original order.
    jokes.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes) || a.id - b.id);
    return { jokes, error: null };
  } catch (e) {
    return { jokes: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export default async function JokesPage() {
  const session = await getSession();
  const { jokes, error } = await loadJokes(session?.user.id ?? null);

  return (
    <main className="flex-1 px-6 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
            Rows from Supabase · ranked by your votes
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Jokes</h1>
          <p className="mt-3 text-white/60">
            Every card below is one row from the{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-white/80">
              jokes
            </code>{" "}
            table. Vote them up or down; the best ones rise to the top.
          </p>
          {!session && (
            <p className="mt-3 text-sm text-white/50">
              <Link href="/login" className="text-amber-300 hover:text-amber-200">
                Sign in
              </Link>{" "}
              to vote.
            </p>
          )}
        </header>

        {error ? (
          <div className="mt-10 rounded-xl border border-red-400/30 bg-red-500/10 p-5">
            <p className="font-medium text-red-200">Could not load jokes from Supabase.</p>
            <p className="mt-2 font-mono text-sm text-red-200/80">{error}</p>
          </div>
        ) : jokes.length === 0 ? (
          <p className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-white/60">
            The jokes table is empty. Add a row in Supabase and refresh.
          </p>
        ) : (
          <>
            <p className="mt-10 font-mono text-xs text-white/40">
              {jokes.length} {jokes.length === 1 ? "row" : "rows"}
            </p>
            <ol className="mt-3 flex flex-col gap-3">
              {jokes.map((joke, i) => (
                <li
                  key={joke.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-white/35">#{i + 1}</span>
                      <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-200/90">
                        {joke.category}
                      </span>
                    </div>
                    <p className="mt-3 text-lg leading-snug text-white">{joke.setup}</p>
                    <p className="mt-2 text-white/60">{joke.punchline}</p>
                  </div>
                  <VoteButtons
                    kind="joke"
                    captionId={joke.id}
                    upvotes={joke.upvotes}
                    downvotes={joke.downvotes}
                    myVote={joke.myVote}
                    signedIn={session !== null}
                  />
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}
