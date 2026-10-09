import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { StoryCard } from "@/lib/share-image";
import { getPost } from "@/lib/feed";

/** GET /p/123/story → a 1080×1920 PNG for Instagram stories. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  const post = Number.isInteger(postId) && postId > 0 ? await getPost(postId, null) : null;
  if (!post) return new Response("Post not found", { status: 404 });

  const link = `${request.nextUrl.host}/p/${post.id}`;
  return new ImageResponse(<StoryCard post={post} link={link} />, {
    width: 1080,
    height: 1920,
    headers: {
      "Content-Disposition": `inline; filename="three-takes-${post.id}.png"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
