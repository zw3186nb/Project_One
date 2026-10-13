/** Shown instantly while a page loads its data from Supabase. */
export default function Loading() {
  return (
    <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12" aria-busy="true" aria-label="Loading">
      <div className="mx-auto w-full max-w-5xl animate-pulse">
        <div className="h-4 w-56 rounded bg-white/10" />
        <div className="mt-4 h-10 w-72 rounded bg-white/10" />
        <div className="mt-4 h-4 w-full max-w-xl rounded bg-white/5" />
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="h-[420px] rounded-2xl bg-white/[0.04]" />
          <div className="hidden h-56 rounded-2xl bg-white/[0.04] lg:block" />
        </div>
      </div>
    </main>
  );
}
