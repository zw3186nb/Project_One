import type { VoiceScore } from "@/lib/feed";
import { voiceInfo } from "@/lib/voices";

/** Which voice is winning across every caption on the site. */
export function VoiceScoreboard({ scores }: { scores: VoiceScore[] }) {
  const ranked = [...scores].sort((a, b) => b.net - a.net);
  const top = Math.max(1, ...ranked.map((s) => Math.abs(s.net)));
  const totalVotes = scores.reduce((sum, s) => sum + s.votes, 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          Voice scoreboard
        </h2>
        <span className="font-mono text-[11px] text-white/40">
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast
        </span>
      </div>

      {totalVotes === 0 ? (
        <p className="mt-3 text-sm text-white/55">
          No votes yet. The first one decides who is in the lead.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {ranked.map((score, i) => {
            const voice = voiceInfo(score.voice);
            return (
              <li key={score.voice}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-white/85">
                    <span className="mr-2 font-mono text-xs text-white/35">{i + 1}</span>
                    {voice.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-white/60">
                    {score.net > 0 ? `+${score.net}` : score.net}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${voice.bar}`}
                    style={{ width: `${Math.max(0, (score.net / top) * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
