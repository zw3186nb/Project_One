"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { castVote } from "@/app/actions";
import { voiceInfo, type VoiceKey } from "@/lib/voices";
import { PostPhoto } from "./post-photo";

type DeckCaption = { id: number; voice: VoiceKey; content: string; upvotes: number; downvotes: number };

export type DeckPost = {
  id: number;
  image_path: string;
  note: string | null;
  author_name: string;
  ai_location: string | null;
  /** The viewer posted this photo themselves. */
  mine: boolean;
  captions: DeckCaption[];
};

type Phase =
  | { kind: "choose"; error?: string }
  | { kind: "saving"; pick: number }
  | { kind: "result"; pick: number; counted: boolean };

/**
 * One photo at a time: pick the funniest take, see how the crowd voted,
 * move on. A pick is saved as an upvote on that caption.
 */
export function JudgeDeck({ posts, signedIn }: { posts: DeckPost[]; signedIn: boolean }) {
  const [deck, setDeck] = useState(posts);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const [tally, setTally] = useState({ judged: 0, agreed: 0 });
  const [, startTransition] = useTransition();

  const post = deck[index];

  const pick = useCallback(
    (captionId: number) => {
      if (!post || phase.kind !== "choose") return;

      // Count the vote straight away, so the result shows without waiting.
      const show = (counted: boolean) => {
        const captions = counted
          ? post.captions.map((c) => (c.id === captionId ? { ...c, upvotes: c.upvotes + 1 } : c))
          : post.captions;
        const best = Math.max(...captions.map((c) => c.upvotes));
        // Nobody has voted yet (a visitor on a fresh photo): nothing to agree with.
        const agreed = best > 0 && captions.find((c) => c.id === captionId)!.upvotes === best;
        setDeck((d) => d.map((p, i) => (i === index ? { ...p, captions } : p)));
        setTally((t) => ({ judged: t.judged + 1, agreed: t.agreed + (agreed ? 1 : 0) }));
        setPhase({ kind: "result", pick: captionId, counted });
      };

      if (!signedIn) return show(false); // visitors play along; nothing is saved

      setPhase({ kind: "saving", pick: captionId });
      startTransition(async () => {
        const result = await castVote(captionId, 1);
        if (result.ok) show(true);
        else setPhase({ kind: "choose", error: result.message });
      });
    },
    [post, phase.kind, signedIn, index],
  );

  const next = useCallback(() => {
    setIndex((i) => i + 1);
    setPhase({ kind: "choose" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Keyboard: 1/2/3 picks a take, Enter or → goes to the next photo.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
      if (phase.kind === "choose" && post) {
        const caption = post.captions[Number(event.key) - 1];
        if (caption) pick(caption.id);
      } else if (phase.kind === "result" && (event.key === "Enter" || event.key === "ArrowRight")) {
        event.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, post, pick, next]);

  if (!post) return <CaughtUp tally={tally} signedIn={signedIn} hadPhotos={posts.length > 0} />;

  const totalUp = post.captions.reduce((sum, c) => sum + c.upvotes, 0);
  const crowdTop = Math.max(...post.captions.map((c) => c.upvotes));
  const chosen = phase.kind === "choose" ? null : phase.pick;
  const showResult = phase.kind === "result";
  const favorite = post.captions.find((c) => c.upvotes === crowdTop);

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between font-mono text-xs text-white/45">
        <span>
          Photo {index + 1} of {deck.length}
        </span>
        {tally.judged > 0 && (
          <span>
            🎯 {tally.agreed}/{tally.judged} agreed with the crowd
          </span>
        )}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: `${((index + (showResult ? 1 : 0)) / deck.length) * 100}%` }}
        />
      </div>

      <article
        key={post.id}
        className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] animate-rise"
      >
        <PostPhoto post={post} className="max-h-[420px] object-contain" />
        <div className="p-4 sm:p-5">
          <p className="text-xs text-white/45">
            Posted by <span className="text-white/75">{post.author_name}</span>
            {post.mine && " (you)"}
          </p>
          {post.note && <p className="mt-1.5 text-[15px] text-white/75">“{post.note}”</p>}

          <h2 className="mt-4 text-sm font-semibold">
            {showResult ? "How the crowd voted" : "Tap the funniest take"}
          </h2>

          <ul className="mt-2.5 flex flex-col gap-2.5">
            {post.captions.map((caption, i) => {
              const voice = voiceInfo(caption.voice);
              const isPick = caption.id === chosen;
              const share = totalUp ? Math.round((caption.upvotes / totalUp) * 100) : 0;
              return (
                <li key={caption.id}>
                  <button
                    type="button"
                    onClick={() => pick(caption.id)}
                    disabled={phase.kind !== "choose"}
                    aria-pressed={isPick}
                    className={`group relative w-full overflow-hidden rounded-xl border p-3.5 text-left transition ${
                      isPick
                        ? "border-amber-300 bg-amber-300/[0.08]"
                        : phase.kind === "choose"
                          ? "cursor-pointer border-white/10 bg-white/[0.02] hover:border-amber-300/50 hover:bg-white/[0.05]"
                          : "border-white/10 bg-white/[0.02] opacity-80"
                    }`}
                  >
                    {/* The crowd's share fills in behind the text once you've picked. */}
                    {showResult && (
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 ${voice.bar} opacity-15 transition-all duration-700`}
                        style={{ width: `${share}%` }}
                      />
                    )}
                    <span className="relative flex items-start gap-3">
                      <span className="mt-0.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/15 font-mono text-xs text-white/50 sm:flex">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${voice.chip}`}
                          >
                            {voice.label}
                          </span>
                          {isPick && (
                            <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                              {phase.kind === "saving" ? "Saving…" : "Your pick"}
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block text-[15px] leading-snug text-white">
                          {caption.content}
                        </span>
                      </span>
                      {showResult && (
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-white/80">
                          {share}%
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {phase.kind === "choose" && phase.error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {phase.error}
            </p>
          )}

          {showResult ? (
            <div className="mt-5 animate-rise">
              <p className="text-sm text-white/80">
                {totalUp === 0
                  ? "Nobody has voted on this one yet. Sign in and be the first."
                  : phase.counted && totalUp === 1
                    ? "🥇 First vote! You set the bar for this one."
                    : post.captions.find((c) => c.id === chosen)?.upvotes === crowdTop
                      ? "🎯 You agree with the crowd."
                      : `🌶️ Hot take! The crowd prefers ${voiceInfo(favorite?.voice ?? "").label}.`}
              </p>
              {!phase.counted && (
                <p className="mt-1 text-xs text-white/50">
                  Your pick wasn&apos;t saved.{" "}
                  <Link href="/login" className="text-amber-300 hover:text-amber-200">
                    Sign in
                  </Link>{" "}
                  to make it count.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={next}
                  autoFocus
                  className="cursor-pointer rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
                >
                  {index + 1 < deck.length ? "Next photo →" : "Finish →"}
                </button>
                <Link href={`/p/${post.id}`} className="text-sm text-white/60 hover:text-white">
                  Open post &amp; share
                </Link>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={phase.kind !== "choose"}
              className="mt-4 cursor-pointer text-sm text-white/45 hover:text-white/80 disabled:opacity-40"
            >
              Skip this one
            </button>
          )}
        </div>
      </article>
    </div>
  );
}

function CaughtUp({
  tally,
  signedIn,
  hadPhotos,
}: {
  tally: { judged: number; agreed: number };
  signedIn: boolean;
  hadPhotos: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center animate-rise">
      <p className="text-4xl" aria-hidden>
        🎉
      </p>
      <h2 className="mt-3 text-xl font-semibold">
        {hadPhotos ? "You're all caught up" : signedIn ? "Nothing new to judge" : "No photos yet"}
      </h2>
      <p className="mt-2 text-sm text-white/60">
        {tally.judged > 0
          ? `You judged ${tally.judged} ${tally.judged === 1 ? "photo" : "photos"} and agreed with the crowd ${tally.agreed} ${tally.agreed === 1 ? "time" : "times"}.`
          : "You've voted on every photo. New ones show up here as people post."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={signedIn ? "/create" : "/login"}
          className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
        >
          {signedIn ? "Post your own photo" : "Sign in to post"}
        </Link>
        <Link
          href="/"
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/45"
        >
          Back to the feed
        </Link>
      </div>
    </div>
  );
}
