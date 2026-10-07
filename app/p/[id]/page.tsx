import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { getSession } from "@/lib/auth";
import { getPost } from "@/lib/feed";

export const metadata = { title: "Post | Three Takes" };

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
