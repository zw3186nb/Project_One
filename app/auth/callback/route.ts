import { NextResponse, type NextRequest } from "next/server";
import { hasName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Google sends the user back here (via Supabase) with a one-time `code`.
 * We trade the code for a session, then decide where the user goes next:
 * new users without a name go to /onboarding, everyone else to /members.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return to("/login?error=cancelled");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/login?error=exchange");

  const user = data.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  // The database trigger normally creates this row at sign-up. This is a
  // safety net for accounts that existed before the trigger did.
  if (!profile) {
    await supabase.from("profiles").upsert({ id: user.id, email: user.email ?? null });
  }

  return to(hasName(profile) ? "/members" : "/onboarding");
}
