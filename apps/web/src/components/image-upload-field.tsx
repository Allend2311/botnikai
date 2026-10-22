"use client";

import { useState } from "react";

export function ImageUploadField({
  guildId,
  imageType,
  name,
  label,
  initialUrl,
}: {
  guildId: string;
  imageType: "welcome" | "goodbye";
  name: string;
  label: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadFile(file: File | undefined): Promise<void> {
    if (!file) return;

    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.set("guildId", guildId);
    formData.set("imageType", imageType);
    formData.set("file", file);

    try {
      const response = await fetch("/api/dashboard/upload-welcome-image", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Upload failed. Please try again.");
        return;
      }
      setUrl(result.url);
      setPreviewFailed(false);
      setMessage("Image uploaded. Save the settings to use it.");
    } catch {
      setMessage("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor={name} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="file"
          id={name}
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={uploading}
          onChange={(event) => {
            void uploadFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
          className="block w-full min-w-0 rounded-lg border border-white/10 bg-ink-950/70 text-sm text-slate-300 file:mr-3 file:border-0 file:bg-white/5 file:px-3 file:py-2 file:text-sm file:text-slate-200 disabled:opacity-60"
        />
      </div>
      <label htmlFor={`${name}-url`} className="block text-xs font-medium text-slate-400">
        Or paste a public HTTPS image URL
      </label>
      <input
        id={`${name}-url`}
        type="url"
        value={url}
        onChange={(event) => {
          setUrl(event.currentTarget.value);
          setPreviewFailed(false);
        }}
        placeholder="https://example.com/image.gif"
        className="w-full rounded-lg border border-white/10 bg-ink-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      <p aria-live="polite" className="text-xs text-slate-500">
        {message || "Choose a PNG, JPEG, WebP, or GIF file up to 8 MB."}
      </p>
      {url && (
        <div className="space-y-2">
          {previewFailed ? (
            <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
              This image could not be loaded. Check that the URL is publicly accessible.
            </p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`${imageType} image preview`}
              onError={() => setPreviewFailed(true)}
              className="max-h-48 max-w-full rounded-lg border border-white/10 object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => {
              setUrl("");
              setMessage("Image removed. Save the settings to apply the change.");
            }}
            className="text-xs text-rose-300 transition hover:text-rose-200"
          >
            Remove image
          </button>
        </div>
      )}
    </div>
  );
}
