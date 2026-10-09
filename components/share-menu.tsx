"use client";

import { useState } from "react";

type ShareMenuProps = {
  postId: number;
  /** One line that goes with the link, e.g. the winning caption. */
  text: string;
};

type Status = { ok: boolean; message: string } | null;

const itemClass =
  "flex cursor-pointer items-center justify-center rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold text-white/85 transition hover:border-white/40 hover:text-white";

/**
 * Share a post to WhatsApp, Instagram, X or Facebook, or copy its link.
 * On phones, "More" opens the system share sheet. Instagram has no way to
 * share a web link, so we share (or download) a ready-made story image.
 */
export function ShareMenu({ postId, text }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  const url = () => `${window.location.origin}/p/${postId}`;
  const message = () => `${text}\n${url()}`;
  const storyPath = `/p/${postId}/story`;
  const storyFileName = `three-takes-${postId}.png`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url());
      setStatus({ ok: true, message: "Link copied." });
    } catch {
      setStatus({ ok: false, message: `Copy this link: ${url()}` });
    }
  }

  async function shareNative() {
    try {
      await navigator.share({ title: "Three Takes", text, url: url() });
    } catch {
      // The person closed the share sheet; nothing to do.
    }
  }

  async function shareToInstagram() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(storyPath);
      if (!response.ok) throw new Error("Could not make the story image.");
      const file = new File([await response.blob()], storyFileName, { type: "image/png" });

      // Phones: hand the image to the share sheet, where Instagram is listed.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Three Takes" }).catch(() => {});
        return;
      }

      // Computers: download it, then post it from the Instagram app.
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = storyFileName;
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus({
        ok: true,
        message: "Story image downloaded. Post it to your Instagram story and add the link sticker.",
      });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  const canShareNatively = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setStatus(null);
        }}
        aria-expanded={open}
        className="cursor-pointer text-xs font-semibold text-amber-300 transition hover:text-amber-200"
      >
        {open ? "Close" : "Share"}
      </button>

      {open && (
        <div className="flex max-w-[22rem] flex-wrap justify-end gap-2" role="group" aria-label="Share options">
          <a
            className={itemClass}
            href={`https://wa.me/?text=${encodeURIComponent(message())}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          <button type="button" className={itemClass} onClick={shareToInstagram} disabled={busy}>
            {busy ? "Making image…" : "Instagram"}
          </button>
          <a
            className={itemClass}
            href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            X
          </a>
          <a
            className={itemClass}
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>
          <button type="button" className={itemClass} onClick={copyLink}>
            Copy link
          </button>
          {canShareNatively && (
            <button type="button" className={itemClass} onClick={shareNative}>
              More…
            </button>
          )}
        </div>
      )}

      {status && (
        <p role="status" className={`max-w-[22rem] text-right text-xs ${status.ok ? "text-emerald-300" : "text-red-300"}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
