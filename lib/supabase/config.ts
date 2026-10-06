/**
 * Reads the Supabase URL and anon key from environment variables.
 *
 * They are never hardcoded. Locally they come from `.env.local`
 * (git-ignored); on Vercel they come from the project's Environment
 * Variables settings.
 */
export function getSupabaseConfig() {
  // Written out in full so Next.js can inline them into browser code.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add them to .env.local (local) or to Vercel's Environment Variables (deployed).",
    );
  }

  return { url, anonKey };
}
