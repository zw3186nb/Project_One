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
  created_at: string;
};

async function loadJokes(): Promise<{ jokes: Joke[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("jokes")
      .select("id, setup, punchline, category, created_at")
      .order("id", { ascending: true });

    if (error) return { jokes: [], error: error.message };
    return { jokes: data ?? [], error: null };
  } catch (e) {
    return { jokes: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export default async function JokesPage() {
  const { jokes, error } = await loadJokes();

  return (
    <main className="flex-1 px-6 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
            Week 2 · Rows from Supabase
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Jokes
          </h1>
          <p className="mt-3 text-white/60">
            Every card below is one row from the{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-white/80">
              jokes
            </code>{" "}
            table, fetched live when this page loads.
          </p>
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
            <ul className="mt-3 flex flex-col gap-3">
              {jokes.map((joke) => (
                <li
                  key={joke.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                >
                  <div className="flex items-center justify-between gap-4 font-mono text-xs">
                    <span className="text-white/35">#{joke.id}</span>
                    <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-amber-200/90">
                      {joke.category}
                    </span>
                  </div>
                  <p className="mt-3 text-lg leading-snug text-white">{joke.setup}</p>
                  <p className="mt-2 text-white/60">{joke.punchline}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
