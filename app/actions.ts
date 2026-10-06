"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
