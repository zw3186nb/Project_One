import { JudgeDeck, type DeckPost } from "@/components/judge-deck";
import { getSession } from "@/lib/auth";
import { getFeed, hasVotedOn } from "@/lib/feed";

export const metadata = {
  title: "Judge | Three Takes",
  description: "One photo at a time: tap the funniest of three AI takes and see if the crowd agrees.",
};

/**
 * Judge mode: one photo at a time, pick the funniest take, see how
 * everyone else voted. Signed-in users only get photos they haven't
 * voted on yet; visitors can play along, but their picks aren't saved.
 */
export default async function PlayPage() {
  const session = await getSession();
  const viewerId = session?.user.id ?? null;
  const { posts, error } = await getFeed("new", viewerId);

  const queue: DeckPost[] = posts
    // Skip photos you already judged, and your own (no voting for yourself here).
    .filter(
      (post) => post.captions.length > 0 && !(viewerId && (hasVotedOn(post) || post.user_id === viewerId)),
    )
    .map((post) => ({
      id: post.id,
      image_path: post.image_path,
      note: post.note,
      author_name: post.author_name,
      ai_location: post.ai_location,
      mine: post.user_id === viewerId,
      captions: post.captions.map(({ id, voice, content, upvotes, downvotes }) => ({
        id,
        voice,
        content,
        upvotes,
        downvotes,
      })),
    }));

  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">Judge mode</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Which take wins?</h1>
        <p className="mt-2 text-sm text-white/55">
          One photo at a time. Tap the funniest caption, then see if the crowd agrees.
          <span className="hidden sm:inline"> Keyboard: 1 2 3 to pick, Enter for the next photo.</span>
        </p>

        <div className="mt-6">
          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-red-200">
              Could not load photos: {error}
            </p>
          ) : (
            <JudgeDeck posts={queue} signedIn={viewerId !== null} />
          )}
        </div>
      </div>
    </main>
  );
}
