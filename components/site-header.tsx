import Link from "next/link";
import { signOut } from "@/app/actions";
import { avatarUrl, displayName, getSession } from "@/lib/auth";
import { Avatar } from "./avatar";

const linkClass = "text-sm text-white/65 transition hover:text-white";

/**
 * Top navigation. This is the "gated UI": signed-out visitors see a
 * Sign in button; signed-in users see Post, Members, their profile and Sign out.
 */
export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="relative z-10 border-b border-white/10 bg-[#0b0d12]/80 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center gap-5 px-6">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight text-white">
          three-takes
        </Link>
        <Link href="/jokes" className={linkClass}>
          Jokes
        </Link>
        {session && (
          <Link href="/members" className={linkClass}>
            Members
          </Link>
        )}

        <div className="ml-auto flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/create"
                className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                + Post
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm text-white/80 transition hover:text-white"
              >
                <Avatar
                  src={avatarUrl(session.profile.avatar_path)}
                  name={displayName(session.profile)}
                  size={28}
                />
                <span className="hidden max-w-40 truncate sm:inline">
                  {session.profile.first_name?.trim() || "Profile"}
                </span>
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="cursor-pointer rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

/** Shown for an instant while the session is being looked up. */
export function SiteHeaderFallback() {
  return (
    <header className="relative z-10 border-b border-white/10 bg-[#0b0d12]/80">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center gap-5 px-6">
        <span className="font-mono text-sm font-semibold tracking-tight text-white">three-takes</span>
      </nav>
    </header>
  );
}
