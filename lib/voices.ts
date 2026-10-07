/**
 * The three voices every photo gets captioned in. They mirror the three
 * sides of our user, Sam: raised in the Midwest, living in New York,
 * and extremely online.
 */
export const VOICES = [
  {
    key: "midwest_nice",
    label: "Midwest Nice",
    blurb: "Polite, upbeat, quietly rattled.",
    chip: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
    bar: "bg-emerald-300",
  },
  {
    key: "nyc_local",
    label: "NYC Local",
    blurb: "Deadpan. Has seen worse on the 1 train.",
    chip: "border-sky-300/30 bg-sky-300/10 text-sky-200",
    bar: "bg-sky-300",
  },
  {
    key: "chronically_online",
    label: "Chronically Online",
    blurb: "lowercase. meme-brained. self-aware.",
    chip: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200",
    bar: "bg-fuchsia-300",
  },
] as const;

export type VoiceKey = (typeof VOICES)[number]["key"];

export const VOICE_KEYS = VOICES.map((v) => v.key) as VoiceKey[];

export function voiceInfo(key: string) {
  return VOICES.find((v) => v.key === key) ?? VOICES[0];
}
