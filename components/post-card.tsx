import Link from "next/link";
import { bestCaption, photoUrl, timeAgo, type Post } from "@/lib/feed";
import { voiceInfo } from "@/lib/voices";
import { DeletePostButton } from "./delete-post-button";
import { ShareMenu } from "./share-menu";
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

  return (
    <article
      id={`post-${post.id}`}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
    >
      <Link href={`/p/${post.id}`} className="block bg-black/40">
        {/* Served straight from Supabase Storage. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(post.image_path)}
          alt={post.note ? `Photo: ${post.note}` : `Photo posted by ${post.author_name}`}
          loading="lazy"
          className="max-h-[560px] w-full object-contain"
        />
      </Link>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
            <span className="font-medium text-white/75">{post.author_name}</span>
            <Link href={`/p/${post.id}`} className="hover:text-white/80">
              {timeAgo(post.created_at)}
            </Link>
            {post.ai_location && (
              <span title="Where the AI thinks this photo was taken" className="text-white/60">
                📍 {post.ai_location}
              </span>
            )}
          </div>
          <div className="flex items-start gap-4">
            {viewerId === post.user_id && <DeletePostButton postId={post.id} />}
            <ShareMenu postId={post.id} text={shareText} />
          </div>
        </div>
        {post.note && <p className="mt-2 text-sm text-white/65">“{post.note}”</p>}

        <ul className="mt-4 flex flex-col gap-2.5">
          {post.captions.map((caption) => {
            const voice = voiceInfo(caption.voice);
            return (
              <li
                key={caption.id}
                className={`flex items-start justify-between gap-4 rounded-xl border p-3.5 ${
                  caption.id === leaderId
                    ? "border-amber-300/40 bg-amber-300/[0.06]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${voice.chip}`}
                    >
                      {voice.label}
                    </span>
                    {caption.id === leaderId && (
                      <span className="font-mono text-[11px] uppercase tracking-wider text-amber-300">
                        Leading
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
              </li>
            );
          })}
        </ul>

        {generation && (
          <details className="mt-4 text-xs text-white/45">
            <summary className="cursor-pointer select-none hover:text-white/75">
              How these were written (AI prompt)
            </summary>
            {post.ai_scene && (
              <p className="mt-2">
                What the AI saw: <span className="text-white/70">{post.ai_scene}</span>
              </p>
            )}
            <p className="mt-2">
              Model: <span className="font-mono text-white/70">{generation.model}</span>
            </p>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/60">
              {generation.prompt}
            </pre>
          </details>
        )}
      </div>
    </article>
  );
}
