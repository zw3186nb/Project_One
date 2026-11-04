import { NextResponse, type NextRequest } from "next/server";
import { hasName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Google sends the user back here (via Supabase) with a one-time `code`.
 * We trade the code for a session, then decide where the user goes next:
 * new users without a name go to /onboarding, everyone else to the feed.
 */
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return to("/login?error=cancelled");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/login?error=exchange");

  const user = data.user;

  // Sign-up rules from the admin area: allowed e-mail domains and whitelisted
  // addresses. While both lists are empty everyone may join; admins always can.
  const { data: allowed, error: ruleError } = await supabase.rpc("signup_allowed", { check_email: user.email ?? "" });
  if (!ruleError && allowed === false) {
    await supabase.auth.signOut();
    return to("/login?error=not_allowed");
  }
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

  return to(hasName(profile) ? "/" : "/onboarding");
}
