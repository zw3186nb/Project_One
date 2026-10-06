type AvatarProps = {
  src: string | null;
  name: string;
  size?: number;
};

/** Round profile photo, falling back to the person's initial. */
export function Avatar({ src, name, size = 32 }: AvatarProps) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (src) {
    return (
      // Plain <img>: the photo is served straight from Supabase Storage.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name}'s profile photo`}
        style={style}
        className="shrink-0 rounded-full border border-white/15 object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/15 font-semibold text-amber-200"
    >
      {initial}
    </span>
  );
}
