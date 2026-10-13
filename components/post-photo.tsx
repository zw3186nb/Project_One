import Link from "next/link";
import type { Post } from "@/lib/feed";
import { photoUrl } from "@/lib/photo-url";

/** The photo, letterboxed over a blurred copy of itself so any shape looks good. */
export function PostPhoto({
  post,
  href,
  className = "max-h-[520px] object-contain",
}: {
  post: Pick<Post, "image_path" | "note" | "author_name" | "ai_location">;
  href?: string;
  className?: string;
}) {
  const src = photoUrl(post.image_path);
  const photo = (
    <div className="relative overflow-hidden bg-black">
      {/* Served straight from Supabase Storage. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={post.note ? `Photo: ${post.note}` : `Photo posted by ${post.author_name}`}
        loading="lazy"
        className={`relative mx-auto w-full ${className}`}
      />
      {post.ai_location && (
        <span
          title="Where the AI thinks this photo was taken"
          className="absolute bottom-3 left-3 max-w-[85%] truncate rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur"
        >
          📍 {post.ai_location}
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block" aria-label="Open this post">
      {photo}
    </Link>
  ) : (
    photo
  );
}
