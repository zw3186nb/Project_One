import Link from "next/link";
import { getSession } from "@/lib/auth";

const steps = ["GitHub", "IntelliJ", "Next.js", "Supabase", "Google sign-in", "Vercel"];

export default async function Home() {
  const session = await getSession();
  const firstName = session?.profile.first_name?.trim();

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-20">
      {/* Faint grid that fades out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 25%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 70%)",
        }}
      />
      {/* Warm glow behind the headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-[60%] rounded-full bg-amber-500/20 blur-[120px]"
      />

      <section className="relative flex flex-col items-center text-center">
        <p className="mb-8 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          Week 3 · Sign in with Google
        </p>

        <h1 className="bg-linear-to-b from-white to-white/55 bg-clip-text text-6xl font-semibold tracking-tight text-transparent sm:text-8xl">
          Hello World
        </h1>

        <p className="mt-6 max-w-md text-base text-white/60 sm:text-lg">
          {session
            ? `Welcome back${firstName ? `, ${firstName}` : ""}. The members area is unlocked.`
            : "A Next.js app with live Supabase data. Sign in to unlock the members area."}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {session ? (
            <Link
              href="/members"
              className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              Open the members area →
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              Sign in with Google →
            </Link>
          )}
          <Link
            href="/jokes"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/35"
          >
            View the jokes list
          </Link>
        </div>

        <ol className="mt-12 flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-white/70">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5">
                {step}
              </span>
              {i < steps.length - 1 && <span className="text-white/30">→</span>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
