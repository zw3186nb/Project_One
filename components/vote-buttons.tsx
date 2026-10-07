"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { castVote } from "@/app/actions";

type VoteButtonsProps = {
  captionId: number;
  upvotes: number;
  downvotes: number;
  myVote: number;
  signedIn: boolean;
};

const base =
  "flex h-8 min-w-12 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold tabular-nums transition";
const idle = "border-white/15 text-white/70 hover:border-white/40 hover:text-white";
const upOn = "border-amber-300 bg-amber-300 text-black";
const downOn = "border-rose-300 bg-rose-300 text-black";

/**
 * Up / down vote for one caption. The numbers change the instant you click
 * (optimistic update), then settle to whatever the database reports back.
 */
export function VoteButtons({ captionId, upvotes, downvotes, myVote, signedIn }: VoteButtonsProps) {
  const [state, setState] = useState({ upvotes, downvotes, myVote });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Visitors see the same buttons, but clicking takes them to sign in.
  if (!signedIn) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <Link href="/login" className={`${base} ${idle}`} aria-label="Sign in to upvote">
          <span aria-hidden>▲</span>
          {upvotes}
        </Link>
        <Link href="/login" className={`${base} ${idle}`} aria-label="Sign in to downvote">
          <span aria-hidden>▼</span>
          {downvotes}
        </Link>
      </div>
    );
  }

  function vote(direction: 1 | -1) {
    const previous = state;
    const next = previous.myVote === direction ? 0 : direction; // click again to undo

    setError(null);
    setState({
      upvotes: previous.upvotes - (previous.myVote === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
      downvotes: previous.downvotes - (previous.myVote === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
      myVote: next,
    });

    startTransition(async () => {
      const result = await castVote(captionId, next);
      if (result.ok) {
        setState({ upvotes: result.upvotes, downvotes: result.downvotes, myVote: result.myVote });
        router.refresh(); // update the "Leading" badge and the scoreboard
      } else {
        setState(previous);
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={pending}
          aria-pressed={state.myVote === 1}
          aria-label={`Upvote (${state.upvotes})`}
          className={`${base} ${state.myVote === 1 ? upOn : idle}`}
        >
          <span aria-hidden>▲</span>
          {state.upvotes}
        </button>
        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={pending}
          aria-pressed={state.myVote === -1}
          aria-label={`Downvote (${state.downvotes})`}
          className={`${base} ${state.myVote === -1 ? downOn : idle}`}
        >
          <span aria-hidden>▼</span>
          {state.downvotes}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
