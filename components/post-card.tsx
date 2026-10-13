import Link from "next/link";
import {
  bestCaption,
  hasVotedOn,
  postVoteCount,
  timeAgo,
  upvoteShares,
  type Post,
} from "@/lib/feed";
import { voiceInfo } from "@/lib/voices";
import { DeletePostButton } from "./delete-post-button";
import { ShareMenu } from "./share-menu";
import { PostPhoto } from "./post-photo";
import { VoteButtons } from "./vote-buttons";

type PostCardProps = {
  post: Post;
  /** The signed-in viewer's user id, or null for visitors. */
  viewerId: string | null;
};

/** One photo with its three AI captions and their vote buttons. */
export function PostCard({ post, viewerId }: PostCardProps) {
  const nets = post.captions.map((c) => c.upvotes - c.downvotes);
  const best = Math.max(0, ...nets);
  // A caption "leads" only when it is strictly ahead and above zero.
  const leaderId =
    best > 0 && nets.filter((n) => n === best).length === 1
      ? post.captions[nets.indexOf(best)].id
      : null;
  const generation = post.captions[0];
  const top = bestCaption(post);
  const shareText = top
    ? `"${top.content}" (${voiceInfo(top.voice).label}) · Three Takes: vote for the funniest caption`
    : "Three Takes: vote for the funniest caption";
  // Show how the votes split only after you have voted, so you judge for yourself first.
  const revealed = hasVotedOn(post);
  const shares = upvoteShares(post);
  const votes = postVoteCount(post);

  return (
    <article
      id={`post-${post.id}`}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
    >
      <PostPhoto post={post} href={`/p/${post.id}`} />

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80"
            >
              {post.author_name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <span className="truncate font-medium text-white/85">{post.author_name}</span>
            <Link href={`/p/${post.id}`} className="shrink-0 text-xs text-white/40 hover:text-white/75">
              {timeAgo(post.created_at)}
            </Link>
          </div>
          <div className="flex shrink-0 items-start gap-4">
            {viewerId === post.user_id && <DeletePostButton postId={post.id} />}
            <ShareMenu postId={post.id} text={shareText} />
          </div>
        </div>
        {post.note && <p className="mt-3 text-[15px] text-white/75">“{post.note}”</p>}

        <div className="mt-5 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">
            {revealed ? "How everyone voted" : "Which take is funniest?"}
          </h3>
          <span className="font-mono text-[11px] text-white/40">
            {votes} {votes === 1 ? "vote" : "votes"}
          </span>
        </div>

        <ul className="mt-2.5 flex flex-col gap-2.5">
          {post.captions.map((caption) => {
            const voice = voiceInfo(caption.voice);
            const share = shares.get(caption.id) ?? 0;
            return (
              <li
                key={caption.id}
                className={`relative overflow-hidden rounded-xl border p-3.5 ${
                  caption.id === leaderId
                    ? "border-amber-300/40 bg-amber-300/[0.06]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        title={voice.blurb}
                        className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${voice.chip}`}
                      >
                        {voice.label}
                      </span>
                      {caption.id === leaderId && (
                        <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                          🏆 Leading
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[15px] leading-snug text-white">{caption.content}</p>
                  </div>
                  <VoteButtons
                    captionId={caption.id}
                    upvotes={caption.upvotes}
                    downvotes={caption.downvotes}
                    myVote={caption.myVote}
                    signedIn={viewerId !== null}
                  />
                </div>
                {revealed && (
                  <div className="mt-3 flex items-center gap-2.5 animate-rise">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${voice.bar}`} style={{ width: `${share}%` }} />
                    </div>
                    <span className="w-9 text-right font-mono text-[11px] tabular-nums text-white/55">
                      {share}%
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {generation && (
          <details className="mt-4 text-xs text-white/45">
            <summary className="cursor-pointer select-none hover:text-white/75">
              Behind the scenes: what the AI saw
            </summary>
            {post.ai_scene && (
              <p className="mt-2 text-sm leading-relaxed text-white/70">{post.ai_scene}</p>
            )}
            <p className="mt-2">
              Model: <span className="font-mono text-white/70">{generation.model}</span>
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer select-none hover:text-white/75">Full prompt</summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/60">
                {generation.prompt}
              </pre>
            </details>
          </details>
        )}
      </div>
    </article>
  );
}
