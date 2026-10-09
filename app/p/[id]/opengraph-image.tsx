import { ImageResponse } from "next/og";
import { LinkPreview } from "@/lib/share-image";
import { getPost } from "@/lib/feed";

// The picture shown when a post's link is pasted into WhatsApp, iMessage, X…
export const alt = "A photo with three AI-written captions on Three Takes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(Number(id), null);

  if (!post) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0d12", color: "white", fontSize: 72, fontWeight: 700 }}>
          Three Takes
        </div>
      ),
      size,
    );
  }

  return new ImageResponse(<LinkPreview post={post} />, size);
}
