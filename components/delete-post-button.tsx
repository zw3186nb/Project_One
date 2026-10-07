"use client";

import { useState, useTransition } from "react";
import { deletePost } from "@/app/actions";

/** Two-step delete, so a stray click cannot remove a post. */
export function DeletePostButton({ postId }: { postId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer text-xs text-white/40 transition hover:text-red-300"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      {error ? <span className="text-red-300">{error}</span> : <span className="text-white/60">Delete this post?</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await deletePost(postId);
            if (result && !result.ok) setError(result.message);
          })
        }
        className="cursor-pointer font-semibold text-red-300 hover:text-red-200 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="cursor-pointer text-white/50 hover:text-white"
      >
        Cancel
      </button>
    </span>
  );
}
