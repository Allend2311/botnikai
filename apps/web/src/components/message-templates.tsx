"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  saveMessageTemplate,
  sendMessageTemplate,
  type MessageTemplateActionState,
} from "@/app/actions";
import { Badge, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/page-header";

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  embedTitle: string | null;
  embedDescription: string | null;
  updatedAt: string;
}

interface ChannelOption {
  value: string;
  label: string;
}

const EMPTY_ACTION_STATE: MessageTemplateActionState = {
  status: "idle",
  message: "",
};

type EditorTab = "edit" | "preview" | "use";
type UseAction = "send" | "edit" | "schedule" | "automate" | "sticky";

export function MessageTemplates({
  guildId,
  guildName,
  templates,
  channels,
  canManage,
}: {
  guildId: string;
  guildName: string;
  templates: MessageTemplate[];
  channels: ChannelOption[];
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null | undefined>();
  const [initialTab, setInitialTab] = useState<EditorTab>("edit");
  const filteredTemplates = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return templates;
    return templates.filter((template) =>
      `${template.name} ${template.content} ${template.embedTitle ?? ""} ${template.embedDescription ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [query, templates]);

  function openEditor(template: MessageTemplate | null, tab: EditorTab = "edit") {
    setEditingTemplate(template);
    setInitialTab(tab);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Message system"
        title={
          <>
            Messages <span className="text-slate-600">/</span>{" "}
            <span className="text-gradient-soft">Templates</span>
          </>
        }
        description="Create reusable messages to send them manually or use them in other modules. Click a template to edit it."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            {templates.length}/100 templates
          </span>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search templates</span>
          <Input
            name="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates"
            className="pr-10"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true">
            ⌕
          </span>
        </label>
        <button
          type="button"
          disabled={!canManage || templates.length >= 100}
          onClick={() => openEditor(null)}
          className="btn btn-primary w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <span aria-hidden="true">＋</span> Create new template
        </button>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-slate-200">
            {templates.length === 0 ? "No templates found" : "No matching templates"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {templates.length === 0 ? "Start by creating one." : "Try a different search."}
          </p>
          {templates.length === 0 && (
            <button
              type="button"
              disabled={!canManage}
              onClick={() => openEditor(null)}
              className="btn btn-primary mt-5 disabled:opacity-50"
            >
              Create new template
            </button>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <li key={template.id}>
              <div className="surface-panel hover-lift h-full rounded-2xl p-4 hover:border-cyan-400/20 sm:p-5">
                <button
                  type="button"
                  onClick={() => openEditor(template)}
                  className="block w-full text-left"
                >
                  <span className="block truncate font-semibold text-white">{template.name}</span>
                  <span className="mt-2 line-clamp-3 min-h-12 whitespace-pre-wrap text-sm text-slate-400">
                    {template.content || template.embedDescription || template.embedTitle}
                  </span>
                  <span className="mt-3 block text-xs text-slate-600">
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </span>
                </button>
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <Badge tone="blue">Template</Badge>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => openEditor(template, "use")}
                    className="text-xs font-semibold text-brand-200 transition hover:text-white disabled:opacity-50"
                  >
                    Use template →
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingTemplate !== undefined && (
        <TemplateEditor
          key={editingTemplate?.id ?? "new-template"}
          guildId={guildId}
          guildName={guildName}
          template={editingTemplate}
          channels={channels}
          canManage={canManage}
          initialTab={initialTab}
          onClose={() => setEditingTemplate(undefined)}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  guildId,
  guildName,
  template,
  channels,
  canManage,
  initialTab,
  onClose,
}: {
  guildId: string;
  guildName: string;
  template: MessageTemplate | null;
  channels: ChannelOption[];
  canManage: boolean;
  initialTab: EditorTab;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<EditorTab>(initialTab);
  const [useAction, setUseAction] = useState<UseAction>("send");
  const [name, setName] = useState(template?.name ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [embedTitle, setEmbedTitle] = useState(template?.embedTitle ?? "");
  const [embedDescription, setEmbedDescription] = useState(template?.embedDescription ?? "");
  const [saveState, saveFormAction] = useActionState(
    saveMessageTemplate.bind(null, guildId, template?.id ?? null),
    EMPTY_ACTION_STATE,
  );
  const [sendState, sendFormAction] = useActionState(
    sendMessageTemplate.bind(null, guildId, template?.id ?? ""),
    EMPTY_ACTION_STATE,
  );

  useEffect(() => {
    if (saveState.status === "success") {
      router.refresh();
      onClose();
    }
  }, [onClose, router, saveState.status]);

  const hasEmbed = Boolean(embedTitle || embedDescription);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-editor-title"
        className="my-auto flex max-h-[min(90vh,850px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-white/10">
          <h2 id="template-editor-title" className="sr-only">
            {template ? `Edit ${template.name}` : "Create template"}
          </h2>
          <div className="grid flex-1 grid-cols-3">
            {(["edit", "preview", "use"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-3 text-sm font-semibold capitalize transition ${
                  activeTab === tab
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template editor"
            className="mx-3 rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === "edit" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-ink-950/50 p-1">
                {(["Visual", "Raw", "Variables"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition ${
                      mode === "Visual" ? "bg-brand-500/20 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <form
                action={saveFormAction}
                className="space-y-4"
                key={template?.id ?? "new-form"}
              >
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Template name</span>
                  <Input
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Welcome message"
                    maxLength={80}
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Message content</span>
                  <Textarea
                    name="content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={6}
                    placeholder={`Write a message for ${guildName}…`}
                    maxLength={2000}
                  />
                  <span className="block text-right text-xs text-slate-600">{content.length}/2000</span>
                </label>
                <details className="rounded-xl border border-white/[0.07] bg-ink-950/30 p-4" open={hasEmbed}>
                  <summary className="cursor-pointer text-sm font-medium text-slate-200">
                    Embed (optional)
                  </summary>
                  <div className="mt-4 space-y-4">
                    <label className="block space-y-2">
                      <span className="text-sm text-slate-300">Embed title</span>
                      <Input
                        name="embedTitle"
                        value={embedTitle}
                        onChange={(event) => setEmbedTitle(event.target.value)}
                        maxLength={256}
                        placeholder="Announcement"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm text-slate-300">Embed description</span>
                      <Textarea
                        name="embedDescription"
                        value={embedDescription}
                        onChange={(event) => setEmbedDescription(event.target.value)}
                        rows={4}
                        maxLength={4096}
                        placeholder="Add more details…"
                      />
                      <span className="block text-right text-xs text-slate-600">
                        {embedDescription.length}/4096
                      </span>
                    </label>
                  </div>
                </details>
                {saveState.message && (
                  <p
                    role="status"
                    className={`text-sm ${saveState.status === "error" ? "text-rose-300" : "text-emerald-300"}`}
                  >
                    {saveState.message}
                  </p>
                )}
                {!canManage && (
                  <p className="text-xs text-amber-200">You need Manage Server permission to save templates.</p>
                )}
                <div className="flex justify-end">
                  <SubmitButton disabled={!canManage}>Save template</SubmitButton>
                </div>
              </form>
              <div className="grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-4">
                <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white">
                  + Embed
                </button>
                <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white">
                  + Action row
                </button>
              </div>
            </div>
          )}

          {activeTab === "preview" && (
            <div className="min-h-80 rounded-xl border border-white/[0.06] bg-ink-900 p-5 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/20 font-bold text-brand-200">
                  K
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Kai_bot <Badge tone="blue">BOT</Badge></p>
                  <p className="text-xs text-slate-500">Preview in {guildName}</p>
                </div>
              </div>
              {content ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{content}</p>
              ) : (
                !hasEmbed && <p className="text-sm italic text-slate-500">Your message preview will appear here.</p>
              )}
              {hasEmbed && (
                <div className="mt-3 max-w-2xl rounded-r-lg border-l-4 border-brand-400 bg-ink-800 p-4">
                  {embedTitle && <h3 className="font-semibold text-white">{embedTitle}</h3>}
                  {embedDescription && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {embedDescription}
                    </p>
                  )}
                </div>
              )}
              <p className="mt-6 text-xs text-slate-600">Mentions are disabled when templates are sent.</p>
            </div>
          )}

          {activeTab === "use" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-ink-950/50 p-1 sm:grid-cols-5">
                {(["send", "edit", "schedule", "automate", "sticky"] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      setUseAction(action);
                    setActiveTab("use");
                    }}
                    className={`rounded-lg px-2 py-2 text-xs font-medium capitalize transition ${
                      useAction === action
                        ? "bg-brand-500/20 text-white"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
              {useAction === "send" && template ? (
                <div className="mx-auto max-w-xl space-y-5 py-5">
                  <p className="text-center text-sm text-slate-300">Send this template into a channel</p>
                  <form action={sendFormAction} className="space-y-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-200">Channel</span>
                      <select
                        name="channelId"
                        required
                        defaultValue=""
                        className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400"
                      >
                        <option value="" disabled>Select a channel</option>
                        {channels.map((channel) => (
                          <option key={channel.value} value={channel.value}>{channel.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-3 text-sm text-slate-300">
                      <input type="checkbox" defaultChecked disabled className="h-4 w-4 accent-brand-500" />
                      Mentions are disabled for safety
                    </label>
                    {sendState.message && (
                      <p
                        role="status"
                        className={`text-sm ${sendState.status === "error" ? "text-rose-300" : "text-emerald-300"}`}
                      >
                        {sendState.message}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <SubmitButton disabled={!canManage}>Send message</SubmitButton>
                    </div>
                  </form>
                </div>
              ) : useAction === "send" ? (
                <p className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm text-amber-200">
                  Save this template before sending it.
                </p>
              ) : useAction === "edit" ? (
                <div className="flex h-full min-h-60 items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab("edit")}
                    className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500"
                  >
                    Edit template
                  </button>
                </div>
              ) : useAction === "schedule" ? (
                <div className="mx-auto max-w-xl space-y-5 py-5">
                  <p className="text-center text-sm text-slate-300">Schedule this template to be sent later</p>
                  <form className="space-y-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-200">Channel</span>
                      <select
                        required
                        defaultValue=""
                        className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400"
                      >
                        <option value="" disabled>Select a channel</option>
                        {channels.map((channel) => (
                          <option key={channel.value} value={channel.value}>{channel.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-slate-200">Date</span>
                        <input
                          type="date"
                          required
                          className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-semibold text-slate-200">Time</span>
                        <input
                          type="time"
                          required
                          className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400"
                        />
                      </label>
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-300">
                      <input type="checkbox" defaultChecked disabled className="h-4 w-4 accent-brand-500" />
                      Mentions are disabled for safety
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!canManage || !template}
                        className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                      >
                        Schedule message
                      </button>
                    </div>
                  </form>
                </div>
              ) : useAction === "automate" ? (
                <div className="mx-auto max-w-xl space-y-5 py-5">
                  <p className="text-center text-sm text-slate-300">Set up automatic sending for this template</p>
                  <div className="space-y-4 rounded-xl border border-white/[0.07] bg-ink-950/40 p-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-200">Trigger</span>
                      <select className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400">
                        <option value="join">On member join</option>
                        <option value="leave">On member leave</option>
                        <option value="levelup">On level up</option>
                        <option value="role">On role added</option>
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-200">Channel</span>
                      <select className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400">
                        <option value="">DM user</option>
                        {channels.map((channel) => (
                          <option key={channel.value} value={channel.value}>{channel.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        disabled={!canManage || !template}
                        className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                      >
                        Save automation
                      </button>
                    </div>
                  </div>
                </div>
              ) : useAction === "sticky" ? (
                <div className="mx-auto max-w-xl space-y-5 py-5">
                  <p className="text-center text-sm text-slate-300">Make this message stick to the bottom of a channel</p>
                  <div className="space-y-4 rounded-xl border border-white/[0.07] bg-ink-950/40 p-5">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-200">Channel</span>
                      <select className="w-full rounded-xl border border-white/10 bg-ink-950 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-400">
                        {channels.map((channel) => (
                          <option key={channel.value} value={channel.value}>{channel.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-3 text-sm text-slate-300">
                      <input type="checkbox" defaultChecked className="h-4 w-4 accent-brand-500" />
                      Auto-update on new messages
                    </label>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        disabled={!canManage || !template}
                        className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                      >
                        Set as sticky
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
