import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client from environment variables.
 *
 * The URL and anon key are never hardcoded. Locally they come from
 * `.env.local` (which is git-ignored); on Vercel they come from the
 * project's Environment Variables settings.
 */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add them to .env.local (local) or to Vercel's Environment Variables (deployed).",
    );
  }

  return createClient(url, anonKey);
}
