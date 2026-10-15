import Link from "next/link";
import { CreatePostForm } from "@/components/create-post-form";
import { requireCompleteProfile } from "@/lib/auth";
import { todaysTheme } from "@/lib/daily";
import { VOICES } from "@/lib/voices";

export const metadata = { title: "New post | Three Takes" };

// Captioning a photo with AI can take a while; give the server action room.
export const maxDuration = 60;

/** Protected: only signed-in users with a finished profile can post. */
export default async function CreatePage({ searchParams }: PageProps<"/create">) {
  const { user } = await requireCompleteProfile();
  const theme = todaysTheme();
  // "+ Post" is open: share anything. "Take the prompt" adds ?prompt=today.
  const forPrompt = (await searchParams).prompt === "today";

  return (
    <main className="flex-1 px-6 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          {forPrompt ? `${theme.weekday}'s prompt · ${theme.title}` : "New post"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {forPrompt ? theme.title : "Share anything"}
        </h1>
        <p className="mt-3 text-white/60">
          {forPrompt
            ? `${theme.hint} The AI writes one caption in each voice, then everyone votes on which take wins.`
            : "Any photo you want to share: campus, the city, your lunch, your roommate's questionable decor. The AI writes one caption in each voice, then everyone votes on which take wins."}
        </p>
        {forPrompt ? (
          <Link href="/create" className="mt-2 inline-block text-sm text-white/50 hover:text-white">
            Not feeling the prompt? Post anything instead →
          </Link>
        ) : (
          <Link
            href="/create?prompt=today"
            className="mt-2 inline-block text-sm text-amber-300/90 hover:text-amber-200"
          >
            Or take {theme.weekday}&apos;s prompt: {theme.title} →
          </Link>
        )}

        <ul className="mt-5 flex flex-wrap gap-2">
          {VOICES.map((voice) => (
            <li
              key={voice.key}
              title={voice.blurb}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${voice.chip}`}
            >
              {voice.label}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <CreatePostForm
            userId={user.id}
            prompt={forPrompt ? { title: theme.title, hint: theme.hint } : null}
          />
        </div>

        <p className="mt-8 text-xs text-white/35">
          Posts are public. Please only share photos you took and are comfortable with anyone seeing. You can
          delete your own posts at any time. Limit: 10 posts per day.
        </p>
      </div>
    </main>
  );
}
