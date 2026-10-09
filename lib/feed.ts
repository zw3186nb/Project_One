import { createClient } from "@/lib/supabase/server";
import { VOICE_KEYS, type VoiceKey } from "@/lib/voices";

export type Caption = {
  id: number;
  voice: VoiceKey;
  content: string;
  upvotes: number;
  downvotes: number;
  prompt: string;
  model: string;
  /** The signed-in viewer's own vote on this caption: 1, -1 or 0. */
  myVote: number;
};

export type Post = {
  id: number;
  user_id: string;
  author_name: string;
  image_path: string;
  note: string | null;
  /** Where the AI thinks the photo was taken. */
  ai_location: string | null;
  /** What the AI saw in the photo before writing the jokes. */
  ai_scene: string | null;
  created_at: string;
  captions: Caption[];
};

export type Sort = "hot" | "new" | "top";

export function parseSort(value: unknown): Sort {
  return value === "new" || value === "top" ? value : "hot";
}

const POST_COLUMNS =
  "id, user_id, author_name, image_path, note, ai_location, ai_scene, created_at, captions(id, voice, content, upvotes, downvotes, prompt, model)";

type Row = Omit<Post, "captions"> & { captions: Omit<Caption, "myVote">[] };

function netVotes(post: Row | Post) {
  return post.captions.reduce((sum, c) => sum + c.upvotes - c.downvotes, 0);
}

function totalVotes(post: Row | Post) {
  return post.captions.reduce((sum, c) => sum + c.upvotes + c.downvotes, 0);
}

/** Newer posts and posts people are voting on float to the top. */
function hotScore(post: Row, now: number) {
  const ageHours = Math.max(0, (now - new Date(post.created_at).getTime()) / 3_600_000);
  return (netVotes(post) + totalVotes(post) * 0.25 + 1) / Math.pow(ageHours + 2, 1.3);
}

/** Adds the viewer's own votes and puts captions in a fixed voice order. */
async function finish(rows: Row[], viewerId: string | null): Promise<Post[]> {
  const myVotes = new Map<number, number>();
  const captionIds = rows.flatMap((row) => row.captions.map((c) => c.id));

  if (viewerId && captionIds.length > 0) {
    const supabase = await createClient();
    // Row Level Security only ever returns the viewer's own votes here.
    const { data } = await supabase
      .from("caption_votes")
      .select("caption_id, vote")
      .in("caption_id", captionIds);
    for (const vote of data ?? []) myVotes.set(vote.caption_id, vote.vote);
  }

  return rows.map((row) => ({
    ...row,
    captions: [...row.captions]
      .sort((a, b) => VOICE_KEYS.indexOf(a.voice) - VOICE_KEYS.indexOf(b.voice))
      .map((c) => ({ ...c, myVote: myVotes.get(c.id) ?? 0 })),
  }));
}

export async function getFeed(sort: Sort, viewerId: string | null): Promise<{ posts: Post[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return { posts: [], error: error.message };

  const rows = (data ?? []) as Row[];
  const now = Date.now();
  if (sort === "top") {
    rows.sort((a, b) => netVotes(b) - netVotes(a) || totalVotes(b) - totalVotes(a));
  } else if (sort === "hot") {
    rows.sort((a, b) => hotScore(b, now) - hotScore(a, now));
  }

  return { posts: await finish(rows, viewerId), error: null };
}

export async function getPost(id: number, viewerId: string | null): Promise<Post | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const [post] = await finish([data as Row], viewerId);
  return post;
}

export type VoiceScore = { voice: VoiceKey; net: number; votes: number };

/** Running totals per voice across every caption, for the scoreboard. */
export async function getVoiceScores(): Promise<VoiceScore[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("voice_scores");
  const rows = (data ?? []) as { voice: string; upvotes: number; downvotes: number }[];

  return VOICE_KEYS.map((voice) => {
    const row = rows.find((r) => r.voice === voice);
    const up = Number(row?.upvotes ?? 0);
    const down = Number(row?.downvotes ?? 0);
    return { voice, net: up - down, votes: up + down };
  });
}

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}

export function timeAgo(iso: string, now: number = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

/** The caption with the most net votes (ties go to the first voice). */
export function bestCaption(post: Post): Caption | null {
  let best: Caption | null = null;
  for (const caption of post.captions) {
    if (!best || caption.upvotes - caption.downvotes > best.upvotes - best.downvotes) best = caption;
  }
  return best;
}

/** Removes emoji, which the share-image renderer cannot draw offline. */
export function stripEmoji(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
