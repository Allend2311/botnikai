"use client";

import { useState, type FormEvent } from "react";
import { Card, Field, Input } from "@/components/ui";

interface BotProfile {
  id: string;
  username: string;
  avatar: string | null;
}

export function ProfileForm({ initialProfile }: { initialProfile: BotProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/owner/profile", {
        method: "POST",
        body: new FormData(form),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        profile?: BotProfile;
      };

      if (!response.ok || !result.ok || !result.profile) {
        throw new Error(result.error ?? "Could not update the bot profile.");
      }

      setProfile(result.profile);
      setSuccess("Bot profile updated.");
      const usernameInput = form.elements.namedItem("username");
      if (usernameInput instanceof HTMLInputElement) {
        usernameInput.value = result.profile.username;
      }
      const avatarInput = form.elements.namedItem("avatar");
      if (avatarInput instanceof HTMLInputElement) {
        avatarInput.value = "";
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the bot profile.");
    } finally {
      setSaving(false);
    }
  }

  const avatar = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith("a_") ? "gif" : "png"}?size=128`
    : null;

  return (
    <Card title="Bot identity" description="Change the bot's Discord name and profile picture across all servers.">
      <form onSubmit={saveProfile} className="space-y-5">
        <div className="flex items-center gap-4">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={`${profile.username} profile`} className="h-16 w-16 rounded-full ring-1 ring-white/15" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-lg font-semibold text-white ring-1 ring-white/15">
              {profile.username.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-medium text-white">{profile.username}</p>
            <p className="mt-1 text-xs text-slate-500">Current Discord bot profile</p>
          </div>
        </div>

        <Field label="Bot name" htmlFor="username" description="Discord bot names must be between 2 and 32 characters.">
          <Input name="username" defaultValue={profile.username} minLength={2} maxLength={32} required />
        </Field>

        <Field label="Profile picture" htmlFor="avatar" description="Optional. PNG, JPEG, WebP, or GIF; maximum 8 MB. Leave empty to keep the current picture.">
          <Input name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200" />
        </Field>

        {(error || success) && (
          <p role="status" className={`text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}>
            {error || success}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving profile…" : "Save profile"}
          </button>
        </div>
      </form>
    </Card>
  );
}
