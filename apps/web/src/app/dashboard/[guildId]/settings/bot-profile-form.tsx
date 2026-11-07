"use client";

import { useState, type FormEvent } from "react";
import { Card, Field, Input } from "@/components/ui";

export function BotProfileForm({
  guildId,
  initialNickname,
  isOwner,
}: {
  guildId: string;
  initialNickname: string | null;
  isOwner: boolean;
}) {
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveNickname(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !isOwner) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/dashboard/${encodeURIComponent(guildId)}/bot-profile`, {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; nickname?: string | null };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not update the bot nickname.");
      }

      const savedNickname = result.nickname ?? "";
      setNickname(savedNickname);
      setSuccess(savedNickname ? "Bot nickname updated for this server." : "Bot nickname reset to the bot's default name.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the bot nickname.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Bot profile in this server"
      description="Set a nickname for the bot in this server. It will not change the bot's name in other servers."
      action={!isOwner ? <span className="text-xs text-amber-200">Server owner only</span> : undefined}
    >
      <form onSubmit={saveNickname} className="space-y-5">
        <Field
          label="Server nickname"
          htmlFor="nickname"
          description="Leave empty and save to restore the default name. Discord does not allow a bot's profile picture to be customized separately per server; the bot owner controls its global picture."
        >
          <Input
            name="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={32}
            placeholder="No custom nickname"
            disabled={!isOwner || saving}
          />
        </Field>

        {!isOwner && <p className="text-xs text-amber-200">Only this Discord server's owner can change the bot's nickname.</p>}
        {(error || success) && (
          <p role="status" className={`text-sm ${error ? "text-rose-300" : "text-emerald-300"}`}>
            {error || success}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isOwner || saving}
            aria-busy={saving}
            className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving nickname…" : "Save nickname"}
          </button>
        </div>
      </form>
    </Card>
  );
}
