"use client";

import { useMemo, useState } from "react";
import { BROADCAST_MESSAGE_MAX, BROADCAST_TITLE_MAX } from "@guardbot/shared";
import { Badge, Card, Field, Input, Textarea } from "@/components/ui";
import type { BroadcastTarget } from "@/lib/broadcast";

type SendState = "idle" | "sending" | "sent" | "failed";

interface ServerStatus {
  state: SendState;
  message?: string;
}

interface Feedback {
  tone: "green" | "red" | "amber";
  text: string;
}

interface ApiResult {
  ok?: boolean;
  error?: string;
  guildName?: string;
  channelName?: string;
}

const DEFAULT_TITLE = "Bot update";

function statusBadge(state: SendState) {
  if (state === "sending") return <Badge tone="blue">Sending</Badge>;
  if (state === "sent") return <Badge tone="green">Sent</Badge>;
  if (state === "failed") return <Badge tone="red">Failed</Badge>;
  return <Badge>Pending</Badge>;
}

export function BroadcastConsole({ targets }: { targets: BroadcastTarget[] }) {
  const deliverable = useMemo(() => targets.filter((target) => target.channelId), [targets]);
  const skipped = useMemo(() => targets.filter((target) => !target.channelId), [targets]);

  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [previewGuildId, setPreviewGuildId] = useState(deliverable[0]?.guildId ?? "");
  const [confirmation, setConfirmation] = useState("");
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({});
  const [running, setRunning] = useState<"preview" | "all" | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: deliverable.length });

  function mark(guildId: string, state: SendState, note?: string) {
    setStatuses((previous) => ({ ...previous, [guildId]: { state, message: note } }));
  }

  async function postTo(guildId: string): Promise<ApiResult> {
    const response = await fetch("/api/owner/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guildId,
        title: title.trim() || DEFAULT_TITLE,
        message,
        imageUrl: imageUrl.trim() || null,
      }),
    });

    const data = (await response.json().catch(() => null)) as ApiResult | null;
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error ?? `Discord request failed (${response.status}).`);
    }
    return data;
  }

  function validate(): string | null {
    if (!message.trim()) return "Write the update message first.";
    if (message.length > BROADCAST_MESSAGE_MAX) {
      return `The message must be shorter than ${BROADCAST_MESSAGE_MAX} characters.`;
    }
    return null;
  }

  async function sendPreview() {
    if (running) return;

    const problem = validate();
    if (problem) {
      setFeedback({ tone: "red", text: problem });
      return;
    }
    if (!previewGuildId) {
      setFeedback({ tone: "red", text: "Choose a server for the preview." });
      return;
    }

    setRunning("preview");
    setFeedback(null);
    mark(previewGuildId, "sending", "Posting…");

    try {
      const result = await postTo(previewGuildId);
      mark(previewGuildId, "sent", `Posted in #${result.channelName ?? "channel"}`);
      setFeedback({
        tone: "green",
        text: `Preview posted in #${result.channelName ?? "channel"} of ${result.guildName ?? "the server"}.`,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "The preview failed.";
      mark(previewGuildId, "failed", text);
      setFeedback({ tone: "red", text });
    } finally {
      setRunning(null);
    }
  }

  async function sendEverywhere() {
    if (running) return;

    const problem = validate();
    if (problem) {
      setFeedback({ tone: "red", text: problem });
      return;
    }
    if (confirmation.trim().toUpperCase() !== "SEND") {
      setFeedback({ tone: "red", text: 'Type SEND in the confirmation box to start the broadcast.' });
      return;
    }
    if (deliverable.length === 0) {
      setFeedback({ tone: "red", text: "No server has a usable update channel yet." });
      return;
    }

    setRunning("all");
    setFeedback(null);
    setStatuses({});
    setProgress({ done: 0, total: deliverable.length });

    let sent = 0;
    let failed = 0;

    for (const [index, target] of deliverable.entries()) {
      mark(target.guildId, "sending", "Posting…");

      try {
        const result = await postTo(target.guildId);
        sent += 1;
        mark(target.guildId, "sent", `Posted in #${result.channelName ?? target.channelName ?? "channel"}`);
      } catch (error) {
        failed += 1;
        mark(target.guildId, "failed", error instanceof Error ? error.message : "Failed");
      }

      setProgress({ done: index + 1, total: deliverable.length });

      // Small pause keeps the global send well below Discord's rate limits.
      if (index < deliverable.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    setRunning(null);
    setConfirmation("");
    setFeedback({
      tone: failed > 0 ? "amber" : "green",
      text: `Broadcast finished: ${sent} sent, ${failed} failed, ${skipped.length} skipped.`,
    });
  }

  const busy = running !== null;
  const progressPercent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs leading-relaxed sm:text-sm ${
            feedback.tone === "green"
              ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200"
              : feedback.tone === "amber"
                ? "border-amber-400/25 bg-amber-400/[0.07] text-amber-200"
                : "border-rose-400/25 bg-rose-400/[0.07] text-rose-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card
            title="Compose update"
            description="This text is posted as a styled embed. No @everyone or @here mentions are ever added."
          >
            <div className="space-y-5">
              <Field label="Title" htmlFor="broadcast-title">
                <Input
                  name="title"
                  id="broadcast-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={BROADCAST_TITLE_MAX}
                  placeholder={DEFAULT_TITLE}
                />
              </Field>

              <Field
                label="Message"
                htmlFor="broadcast-message"
                description={`${message.length}/${BROADCAST_MESSAGE_MAX} characters`}
              >
                <Textarea
                  name="message"
                  id="broadcast-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  maxLength={BROADCAST_MESSAGE_MAX}
                  placeholder="What changed? New features, fixes, maintenance windows…"
                />
              </Field>

              <Field
                label="Image URL (optional)"
                htmlFor="broadcast-image"
                description="Public HTTPS link. Discord displays it below the message."
              >
                <Input
                  name="imageUrl"
                  id="broadcast-image"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/update.png"
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Preview in one server"
            description="Posts the real embed in a single server so you can check how it looks."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Server" htmlFor="broadcast-preview-server" className="min-w-0 flex-1">
                <select
                  id="broadcast-preview-server"
                  value={previewGuildId}
                  onChange={(event) => setPreviewGuildId(event.target.value)}
                  disabled={busy || deliverable.length === 0}
                  className="w-full rounded-xl border border-white/[0.09] bg-white/[0.028] px-3.5 py-3 text-base text-slate-100 outline-none transition duration-200 hover:border-white/15 focus:border-brand-400/70 focus:bg-white/[0.045] focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2.5 sm:text-sm"
                >
                  {deliverable.length === 0 && <option value="">No server available</option>}
                  {deliverable.map((target) => (
                    <option key={target.guildId} value={target.guildId}>
                      {target.guildName} — #{target.channelName}
                    </option>
                  ))}
                </select>
              </Field>

              <button
                type="button"
                onClick={sendPreview}
                disabled={busy || deliverable.length === 0}
                className="btn btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {running === "preview" ? "Posting…" : "Send preview"}
              </button>
            </div>
          </Card>

          <Card
            title="Send to every server"
            description={`This posts the update to ${deliverable.length} server${deliverable.length === 1 ? "" : "s"}. Servers without a suitable channel are skipped.`}
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200/90 sm:text-sm">
                This cannot be undone. Each server receives one embed and no mass mentions are used.
                Type <span className="font-mono font-semibold text-amber-100">SEND</span> to enable the
                button.
              </div>

              <Field
                label="Confirmation"
                htmlFor="broadcast-confirm"
                description="Type SEND in capitals."
              >
                <Input
                  name="confirmation"
                  id="broadcast-confirm"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="SEND"
                  maxLength={10}
                />
              </Field>

              {running === "all" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 sm:text-xs">
                    <span>
                      Sending… {progress.done}/{progress.total}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={sendEverywhere}
                disabled={busy || deliverable.length === 0}
                className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running === "all"
                  ? `Broadcasting… ${progress.done}/${progress.total}`
                  : `Send to all ${deliverable.length} servers`}
              </button>
            </div>
          </Card>
        </div>

        <Card
          title={`Servers (${targets.length})`}
          description={`${deliverable.length} ready, ${skipped.length} skipped. The channel is chosen automatically.`}
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div className="max-h-[38rem] space-y-2 overflow-y-auto pr-1">
            {targets.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500 sm:text-sm">
                The bot is not installed in any server yet.
              </p>
            )}

            {targets.map((target) => {
              const status = statuses[target.guildId];
              return (
                <div
                  key={target.guildId}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3"
                >
                  {target.guildIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={target.guildIcon}
                      alt=""
                      className="mt-0.5 h-8 w-8 shrink-0 rounded-full ring-1 ring-white/10"
                    />
                  ) : (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[10px] font-semibold text-white ring-1 ring-white/10">
                      {target.guildName.slice(0, 2).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200 sm:text-sm">
                      {target.guildName}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500 sm:text-[11px]">
                      {target.channelId ? `#${target.channelName}` : target.reason}
                    </p>
                    {status?.message && (
                      <p
                        className={`mt-1 text-[10px] leading-relaxed sm:text-[11px] ${
                          status.state === "failed" ? "text-rose-300" : "text-slate-500"
                        }`}
                      >
                        {status.message}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {target.channelId ? statusBadge(status?.state ?? "idle") : <Badge tone="amber">Skipped</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
