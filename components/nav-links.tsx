"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; desktopOnly?: boolean };

/** The main sections, with the current one highlighted. */
export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1">
      {links.map(({ href, label, desktopOnly }) => {
        const active =
          href === "/" ? pathname === "/" || pathname.startsWith("/p/") : pathname.startsWith(href);
        return (
          <li key={href} className={desktopOnly ? "hidden sm:block" : undefined}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-2.5 py-1.5 text-sm sm:px-3 transition ${
                active ? "bg-white/10 font-medium text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
