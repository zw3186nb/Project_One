import type { Photographer } from "@/lib/feed";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Whose photos get the most love: net votes across all their captions. */
export function TopPhotographers({ people }: { people: Photographer[] }) {
  if (people.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
        Top photographers
      </h2>
      <ol className="mt-4 flex flex-col gap-2.5">
        {people.map((person, i) => (
          <li key={person.userId} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="w-5 text-center text-xs text-white/40">
                {MEDALS[i] ?? i + 1}
              </span>
              <span className="truncate text-white/85">{person.name}</span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-white/50">
              {person.posts} {person.posts === 1 ? "photo" : "photos"} ·{" "}
              {person.net > 0 ? `+${person.net}` : person.net}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
