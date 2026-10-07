"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateCaptions } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { VOICE_KEYS } from "@/lib/voices";

export type FormState = { ok: boolean; message: string } | null;

const NAME_MAX = 60;

function readName(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

/** Saves first and last name on the signed-in user's own profile row. */
async function saveNames(formData: FormData): Promise<FormState> {
  const firstName = readName(formData, "first_name");
  const lastName = readName(formData, "last_name");

  if (!firstName || !lastName) {
    return { ok: false, message: "Please enter both your first and last name." };
  }
  if (firstName.length > NAME_MAX || lastName.length > NAME_MAX) {
    return { ok: false, message: `Names can be at most ${NAME_MAX} characters.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

/** Profile page: update names and stay on the page. */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  return saveNames(formData);
}

/** First login: save names, then continue into the app. */
export async function completeOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await saveNames(formData);
  if (!result?.ok) return result;
  redirect("/members");
}

/**
 * Records which Storage file is the user's profile photo.
 * The image itself was uploaded to the `avatars` bucket by the browser;
 * the database only stores its path.
 */
export async function saveAvatarPath(path: string): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const expected = new RegExp(`^${user.id}/[A-Za-z0-9-]+\\.(jpg|png|webp|gif)$`);
  if (!expected.test(path)) {
    return { ok: false, message: "That file path is not valid for your account." };
  }

  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    avatar_path: path,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: `Could not save photo: ${error.message}` };

  // Tidy up the previous photo so old files do not pile up.
  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Photo updated." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ───────────────────────── Week 4: posts, AI captions, votes ─────────────────────────

const NOTE_MAX = 200;

/**
 * Creates a post from a photo the browser already uploaded to Storage:
 * 1. asks the AI for three captions,
 * 2. inserts the post row,
 * 3. inserts one caption row per voice, each with the prompt and model used.
 * If any step fails, everything made so far is cleaned up.
 */
export async function createPost(input: { path: string; note: string }): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const path = input.path;
  if (!new RegExp(`^${user.id}/[A-Za-z0-9-]+\\.(jpg|png|webp)$`).test(path)) {
    return { ok: false, message: "That photo is not valid for your account." };
  }
  const note = input.note.trim().slice(0, NOTE_MAX) || null;
  const discardPhoto = () => supabase.storage.from("photos").remove([path]);

  // Read the photo back from Storage so the AI sees exactly what was uploaded.
  const { data: file, error: downloadError } = await supabase.storage.from("photos").download(path);
  if (downloadError || !file) {
    return { ok: false, message: "Could not read the uploaded photo. Please try again." };
  }
  if (file.size > 5 * 1024 * 1024) {
    await discardPhoto();
    return { ok: false, message: "That photo is larger than 5 MB." };
  }

  const generation = await generateCaptions(
    {
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      mimeType: file.type || "image/jpeg",
    },
    note,
  );
  if (!generation.ok) {
    await discardPhoto();
    return { ok: false, message: generation.message };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({ image_path: path, note })
    .select("id")
    .single();
  if (postError || !post) {
    await discardPhoto();
    return { ok: false, message: postError?.message ?? "Could not save the post." };
  }

  const { error: captionError } = await supabase.from("captions").insert(
    VOICE_KEYS.map((voice) => ({
      post_id: post.id,
      voice,
      content: generation.captions[voice],
      prompt: generation.prompt,
      model: generation.model,
    })),
  );
  if (captionError) {
    await supabase.from("posts").delete().eq("id", post.id);
    await discardPhoto();
    return { ok: false, message: `Could not save the captions: ${captionError.message}` };
  }

  redirect(`/p/${post.id}`);
}

export type VoteResult =
  | { ok: true; upvotes: number; downvotes: number; myVote: number }
  | { ok: false; message: string };

/**
 * Records the signed-in user's vote on a caption.
 *   value  1 -> upvote, -1 -> downvote, 0 -> take the vote back
 * A first vote INSERTs a new row into caption_votes. Changing your mind
 * UPDATEs that row; taking it back DELETEs it. A database trigger keeps the
 * caption's counters in sync, and Row Level Security guarantees a user can
 * only ever touch their own vote.
 */
export async function castVote(captionId: number, value: number): Promise<VoteResult> {
  if (!Number.isInteger(captionId) || ![1, -1, 0].includes(value)) {
    return { ok: false, message: "Invalid vote." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to vote." };

  if (value === 0) {
    const { error } = await supabase
      .from("caption_votes")
      .delete()
      .eq("caption_id", captionId)
      .eq("user_id", user.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase
      .from("caption_votes")
      .insert({ caption_id: captionId, vote: value });

    if (error?.code === "23505") {
      // Already voted on this caption: switch the existing vote instead.
      const { error: updateError } = await supabase
        .from("caption_votes")
        .update({ vote: value })
        .eq("caption_id", captionId)
        .eq("user_id", user.id);
      if (updateError) return { ok: false, message: updateError.message };
    } else if (error) {
      return { ok: false, message: error.message };
    }
  }

  const { data: caption } = await supabase
    .from("captions")
    .select("upvotes, downvotes")
    .eq("id", captionId)
    .maybeSingle();
  if (!caption) return { ok: false, message: "That caption no longer exists." };

  return { ok: true, upvotes: caption.upvotes, downvotes: caption.downvotes, myVote: value };
}

/** Deletes one of the signed-in user's own posts, its captions, votes and photo. */
export async function deletePost(postId: number): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deleted, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id)
    .select("image_path");
  if (error) return { ok: false, message: error.message };
  if (!deleted?.length) return { ok: false, message: "You can only delete your own posts." };

  await supabase.storage.from("photos").remove(deleted.map((row) => row.image_path));
  revalidatePath("/", "layout");
  redirect("/");
}
