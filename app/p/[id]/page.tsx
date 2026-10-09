import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { getSession } from "@/lib/auth";
import { bestCaption, getPost } from "@/lib/feed";
import { voiceInfo } from "@/lib/voices";

/**
 * Title and description for link previews. The preview picture itself comes
 * from opengraph-image.tsx in this folder.
 */
export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = Number.isInteger(Number(id)) ? await getPost(Number(id), null) : null;
  if (!post) return { title: "Post | Three Takes" };

  const top = bestCaption(post);
  const title = top ? `"${top.content}"` : "A photo on Three Takes";
  const description = [
    post.ai_location && `📍 ${post.ai_location}.`,
    "One photo, three AI takes (Midwest Nice, NYC Local, Chronically Online). Vote for the funniest.",
    top && `This one is from ${voiceInfo(top.voice).label}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: `${title} · Three Takes`,
    description,
    openGraph: { title, description, type: "article", siteName: "Three Takes" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** A single post on its own page, so it can be shared with a link. */
export default async function PostPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();

  const session = await getSession();
  const post = await getPost(postId, session?.user.id ?? null);
  if (!post) notFound();

  return (
    <main className="flex-1 px-6 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.2em] text-white/50 transition hover:text-amber-300"
        >
          ← All posts
        </Link>
        <div className="mt-6">
          <PostCard post={post} viewerId={session?.user.id ?? null} />
        </div>
        {!session && (
          <p className="mt-5 text-sm text-white/55">
            <Link href="/login" className="text-amber-300 hover:text-amber-200">
              Sign in
            </Link>{" "}
            to vote on which take wins.
          </p>
        )}
      </div>
    </main>
  );
}
