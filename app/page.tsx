const steps = ["GitHub", "IntelliJ", "Next.js", "Vercel"];

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0d12] px-6 text-white">
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
          Week 1 · Live on Vercel
        </p>

        <h1 className="bg-linear-to-b from-white to-white/55 bg-clip-text text-6xl font-semibold tracking-tight text-transparent sm:text-8xl">
          Hello World
        </h1>

        <p className="mt-6 max-w-md text-base text-white/60 sm:text-lg">
          My first Next.js app: created, committed, pushed, and deployed.
        </p>

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
