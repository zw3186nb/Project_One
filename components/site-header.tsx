import Link from "next/link";
import { signOut } from "@/app/actions";
import { avatarUrl, displayName, getSession } from "@/lib/auth";
import { Avatar } from "./avatar";
import { NavLinks } from "./nav-links";

const PUBLIC_LINKS = [
  { href: "/", label: "Feed" },
  { href: "/play", label: "Judge" },
  { href: "/jokes", label: "Jokes" },
];

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 text-white" aria-label="Three Takes home">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 font-mono text-sm font-bold text-black"
      >
        3
      </span>
      <span className="hidden text-sm font-semibold tracking-tight sm:inline">Three Takes</span>
    </Link>
  );
}

/**
 * Top navigation. This is the "gated UI": signed-out visitors see a
 * Sign in button; signed-in users see Post, Members, their profile and Sign out.
 */
export async function SiteHeader() {
  const session = await getSession();
  const links = session
    ? [...PUBLIC_LINKS, { href: "/members", label: "Members", desktopOnly: true }]
    : PUBLIC_LINKS;

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0d12]/85 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Logo />
        <div className="min-w-0 overflow-x-auto">
          <NavLinks links={links} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {session ? (
            <>
              <Link
                href="/create"
                className="rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                + Post
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full text-sm text-white/80 transition hover:text-white"
                title="Your profile and posts"
              >
                <Avatar
                  src={avatarUrl(session.profile.avatar_path)}
                  name={displayName(session.profile)}
                  size={28}
                />
                <span className="hidden max-w-32 truncate md:inline">
                  {session.profile.first_name?.trim() || "Profile"}
                </span>
              </Link>
              <form action={signOut} className="hidden sm:block">
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
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0d12]/85">
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center gap-5 px-4 sm:px-6">
        <Logo />
      </nav>
    </header>
  );
}
