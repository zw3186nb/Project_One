"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAvatarPath } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./avatar";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 5 * 1024 * 1024;

type AvatarUploaderProps = {
  userId: string;
  currentUrl: string | null;
  name: string;
};

/**
 * Uploads a photo to the `avatars` Storage bucket from the browser, then
 * asks the server to store only the file's path on the profile row.
 */
export function AvatarUploader({ userId, currentUrl, name }: AvatarUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    if (!file) return;

    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setStatus({ ok: false, message: "Please choose a JPG, PNG, WebP or GIF image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus({ ok: false, message: "That image is larger than 5 MB." });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, cacheControl: "3600" });
      if (error) throw error;

      const result = await saveAvatarPath(path);
      setStatus(result);
      if (result?.ok) router.refresh();
    } catch (e) {
      setStatus({
        ok: false,
        message: e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar src={currentUrl} name={name} size={88} />
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileChosen}
          className="sr-only"
          aria-label="Choose a profile photo"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="cursor-pointer rounded-full border border-white/20 px-4 py-2 text-sm text-white transition hover:border-white/40 disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? "Uploading…" : currentUrl ? "Change photo" : "Upload a photo"}
        </button>
        <p className="mt-2 text-xs text-white/40">JPG, PNG, WebP or GIF, up to 5 MB.</p>
        {status && (
          <p
            role="status"
            className={`mt-2 text-sm ${status.ok ? "text-emerald-300" : "text-red-300"}`}
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
