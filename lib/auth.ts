import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_path: string | null;
  created_at: string | null;
};

export type Session = { user: User; profile: Profile };

/** True once the user has told us both their first and last name. */
export function hasName(profile: Pick<Profile, "first_name" | "last_name"> | null) {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}

export function displayName(profile: Profile) {
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return full || profile.email || "Member";
}

/** Public URL of a file in the `avatars` Storage bucket. */
export function avatarUrl(path: string | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

/**
 * The signed-in user and their profile row, or null for visitors.
 * Wrapped in React `cache` so the header and the page share one lookup
 * per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // Without configuration there is no way to know who is signed in.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, avatar_path, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = data ?? {
    id: user.id,
    email: user.email ?? null,
    first_name: null,
    last_name: null,
    avatar_path: null,
    created_at: null,
  };

  return { user, profile };
});

/** For protected pages: visitors are sent to /login. */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** For protected pages that also need a name: sends the user to fill it in. */
export async function requireCompleteProfile(): Promise<Session> {
  const session = await requireUser();
  if (!hasName(session.profile)) redirect("/onboarding");
  return session;
}
