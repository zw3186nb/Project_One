import Link from "next/link";
import { signOut, updateProfile } from "@/app/actions";
import { AvatarUploader } from "@/components/avatar-uploader";
import { NameForm } from "@/components/name-form";
import { PostPhoto } from "@/components/post-photo";
import { avatarUrl, displayName, requireCompleteProfile } from "@/lib/auth";
import { bestCaption, getPostsByUser, postVoteCount } from "@/lib/feed";
import { voiceInfo } from "@/lib/voices";

export const metadata = { title: "Profile | Three Takes" };

export default async function ProfilePage() {
  const { user, profile } = await requireCompleteProfile();
  const posts = await getPostsByUser(user.id, user.id);
  const votesReceived = posts.reduce((sum, post) => sum + postVoteCount(post), 0);
  const upvotesReceived = posts.reduce((sum, p) => sum + p.captions.reduce((s, c) => s + c.upvotes, 0), 0);
  const stats = [
    { label: posts.length === 1 ? "Photo" : "Photos", value: posts.length },
    { label: "Votes received", value: votesReceived },
    { label: "Upvotes", value: upvotesReceived },
  ];

  return (
    <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300/90">Your account</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Profile</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-white/60">
            Signed in as <span className="text-white/85">{profile.email ?? user.email}</span>.
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>

        <dl className="mt-8 grid grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <dt className="text-xs text-white/50">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Your photos</h2>
            <Link href="/create" className="text-sm font-semibold text-amber-300 hover:text-amber-200">
              + Post a photo
            </Link>
          </div>
          {posts.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/55">
              You haven&apos;t posted yet. Your photos and how their takes are doing will show up here.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {posts.map((post) => {
                const top = bestCaption(post);
                const votes = postVoteCount(post);
                return (
                  <li
                    key={post.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <PostPhoto post={post} href={`/p/${post.id}`} className="h-44 object-cover" />
                    <div className="p-4">
                      {top && (
                        <>
                          <p className="font-mono text-[11px] text-white/45">
                            {votes > 0 ? `Winning: ${voiceInfo(top.voice).label}` : "No votes yet"} · {votes}{" "}
                            {votes === 1 ? "vote" : "votes"}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-sm text-white/85">{top.content}</p>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <h2 className="mt-12 text-lg font-semibold">Account</h2>
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Profile photo</h2>
          <p className="mt-1 text-sm text-white/50">
            Stored in Supabase Storage. The database only keeps the file&apos;s path.
          </p>
          <div className="mt-5">
            <AvatarUploader
              userId={user.id}
              currentUrl={avatarUrl(profile.avatar_path)}
              name={displayName(profile)}
            />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Name</h2>
          <div className="mt-5">
            <NameForm
              action={updateProfile}
              firstName={profile.first_name ?? ""}
              lastName={profile.last_name ?? ""}
              submitLabel="Save changes"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
