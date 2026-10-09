import { bestCaption, photoUrl, stripEmoji, type Post } from "@/lib/feed";
import { voiceInfo } from "@/lib/voices";

/**
 * Pictures of a post for sharing, drawn with next/og (Satori). Satori only
 * understands inline styles and flexbox, and every element with more than
 * one child needs display: flex.
 */

const INK = "#0b0d12";
const AMBER = "#fbbf24";

const VOICE_COLORS: Record<string, string> = {
  midwest_nice: "#6ee7b7",
  nyc_local: "#7dd3fc",
  chronically_online: "#f0abfc",
};

function net(c: { upvotes: number; downvotes: number }) {
  const n = c.upvotes - c.downvotes;
  return n > 0 ? `+${n}` : `${n}`;
}

/** 1200×630 link preview for WhatsApp, iMessage, X, Facebook and Slack. */
export function LinkPreview({ post }: { post: Post }) {
  const top = bestCaption(post);
  const voice = top ? voiceInfo(top.voice) : null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: INK, color: "white" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl(post.image_path)}
        alt=""
        width={630}
        height={630}
        style={{ width: 630, height: 630, objectFit: "cover" }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 52px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, letterSpacing: 4, color: AMBER, textTransform: "uppercase" }}>
            {post.ai_location ? stripEmoji(post.ai_location).slice(0, 40) : "Three Takes"}
          </div>
          {top && voice && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
              <div style={{ display: "flex", fontSize: 22, color: VOICE_COLORS[top.voice] }}>{voice.label} says</div>
              <div style={{ display: "flex", marginTop: 14, fontSize: 40, lineHeight: 1.22, fontWeight: 700 }}>
                {stripEmoji(top.content)}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 22, color: "rgba(255,255,255,0.6)" }}>
          <div style={{ display: "flex" }}>3 takes · vote for the funniest</div>
          <div style={{ display: "flex", color: "white", fontWeight: 700 }}>three-takes</div>
        </div>
      </div>
    </div>
  );
}

/** 1080×1920 image sized for an Instagram (or WhatsApp) story. */
export function StoryCard({ post, link }: { post: Post; link: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: INK, color: "white", padding: 64 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 34 }}>
        <div style={{ display: "flex", fontWeight: 700 }}>three-takes</div>
        <div style={{ display: "flex", color: AMBER, fontSize: 28, letterSpacing: 3, textTransform: "uppercase" }}>
          {post.ai_location ? stripEmoji(post.ai_location).slice(0, 34) : "vote for the funniest"}
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl(post.image_path)}
        alt=""
        width={952}
        height={820}
        style={{ marginTop: 40, width: 952, height: 820, objectFit: "cover", borderRadius: 36 }}
      />

      <div style={{ display: "flex", flexDirection: "column", marginTop: 40, gap: 24 }}>
        {post.captions.map((caption) => (
          <div
            key={caption.id}
            style={{ display: "flex", flexDirection: "column", padding: "26px 32px", borderRadius: 28, background: "rgba(255,255,255,0.06)", border: "2px solid rgba(255,255,255,0.12)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
              <div style={{ display: "flex", color: VOICE_COLORS[caption.voice] }}>{voiceInfo(caption.voice).label}</div>
              <div style={{ display: "flex", color: "rgba(255,255,255,0.55)" }}>{net(caption)}</div>
            </div>
            <div style={{ display: "flex", marginTop: 10, fontSize: 36, lineHeight: 1.25 }}>{stripEmoji(caption.content)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", alignItems: "center", fontSize: 30, color: "rgba(255,255,255,0.65)" }}>
        <div style={{ display: "flex" }}>Which take wins? Vote at</div>
        <div style={{ display: "flex", marginTop: 8, color: AMBER, fontWeight: 700 }}>{link}</div>
      </div>
    </div>
  );
}
