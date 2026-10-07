import { CreatePostForm } from "@/components/create-post-form";
import { requireCompleteProfile } from "@/lib/auth";
import { todaysTheme } from "@/lib/daily";
import { VOICES } from "@/lib/voices";

export const metadata = { title: "New post | Three Takes" };

// Captioning a photo with AI can take a while; give the server action room.
export const maxDuration = 60;

/** Protected: only signed-in users with a finished profile can post. */
export default async function CreatePage() {
  const { user } = await requireCompleteProfile();
  const theme = todaysTheme();

  return (
    <main className="flex-1 px-6 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">
          {theme.weekday}&apos;s prompt · {theme.title}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Post a photo</h1>
        <p className="mt-3 text-white/60">
          Upload something from your day. The AI writes one caption in each voice, then everyone
          votes on which take wins.
        </p>

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
          <CreatePostForm userId={user.id} themeTitle={theme.title} themeHint={theme.hint} />
        </div>

        <p className="mt-8 text-xs text-white/35">
          Posts are public. Please only share photos you took and are comfortable with anyone
          seeing. You can delete your own posts at any time. Limit: 10 posts per day.
        </p>
      </div>
    </main>
  );
}
