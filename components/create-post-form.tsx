"use client";

import { useEffect, useRef, useState } from "react";
import { createPost } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600; // px. Phone photos are far bigger than a feed needs.
const MAX_BYTES = 5 * 1024 * 1024;
const NOTE_MAX = 200;

type Stage = "idle" | "uploading" | "generating";

/**
 * Shrinks the photo in the browser and re-encodes it as JPEG. Uploads are
 * faster, storage stays small, and the AI gets a sensibly sized image.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image."))),
      "image/jpeg",
      0.85,
    ),
  );
}

type CreatePostFormProps = { userId: string; themeTitle: string; themeHint: string };

export function CreatePostForm({ userId, themeTitle, themeHint }: CreatePostFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  // Free the preview image's memory when it changes or the form goes away.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);

    try {
      const blob = await shrink(file);
      if (blob.size > MAX_BYTES) throw new Error("That photo is too large, even after shrinking.");
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setPhoto(null);
      setPreview(null);
      setError("Could not read that file. Please choose a JPG, PNG or WebP photo.");
    }
  }

  async function submit() {
    if (!photo || stage !== "idle") return;
    setError(null);

    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    try {
      setStage("uploading");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, photo, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setStage("generating");
      // On success the server redirects to the new post, so this only
      // returns when something went wrong.
      const result = await createPost({ path, note });
      if (result && !result.ok) throw new Error(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setStage("idle");
    }
  }

  const busy = stage !== "idle";

  return (
    <div className="flex flex-col gap-5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileChosen}
        hidden
      />

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          {/* A local preview of the chosen photo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your chosen photo" className="max-h-[420px] w-full object-contain" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-6 py-10 text-center transition hover:border-amber-300/50 hover:bg-white/[0.04]"
        >
          <span className="text-base font-semibold text-white">Choose a photo</span>
          <span className="max-w-xs text-sm text-white/50">
            Today&apos;s prompt is <span className="text-amber-200">{themeTitle}</span>. {themeHint}
          </span>
        </button>
      )}

      {preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="cursor-pointer self-start text-sm text-white/60 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
        >
          Choose a different photo
        </button>
      )}

      <label className="text-sm text-white/70">
        Add a note <span className="text-white/40">(optional, helps the AI get the joke)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          disabled={busy}
          placeholder="e.g. the 1 train skipped 116th again"
          className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-white placeholder:text-white/30 focus:border-amber-300/60 focus:outline-none disabled:opacity-60"
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={!photo || busy}
          className="cursor-pointer rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {stage === "uploading"
            ? "Uploading photo…"
            : stage === "generating"
              ? "Writing three takes…"
              : "Get three takes"}
        </button>
        {stage === "generating" && (
          <p role="status" className="text-sm text-white/55">
            The AI is looking at your photo. This takes a few seconds.
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
