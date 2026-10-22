import Link from "next/link";
import { notFound } from "next/navigation";
import { AUTOMOD_ACTIONS, AUTOMOD_ACTION_LABELS, CASE_LABELS, isCaseType, relativeTime } from "@guardbot/shared";
import { saveAutomod } from "@/app/actions";
import {
  channelOptions,
  getGuildContext,
  parseJsonArray,
  roleOptions,
  textChannels,
} from "@/lib/guild";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, Field, Input, Select, Textarea, Toggle } from "@/components/ui";
import { CheckboxGrid } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";
import { WEBSITE_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ACTION_OPTIONS = AUTOMOD_ACTIONS.map((action) => ({
  value: action,
  label: AUTOMOD_ACTION_LABELS[action],
}));

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const { automod, settings, channels, roles } = context;

  const [cases, warnings] = await Promise.all([
    prisma.case.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.warning.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const channelSelect = channelOptions(textChannels(channels));
  const roleSelect = roleOptions(roles);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Moderation</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Configure the auto-moderation rules and review what happened in this server.
        </p>
      </div>

      <form action={saveAutomod.bind(null, guildId)} className="space-y-6">
        <Card
          title="Auto-moderation"
          description={`${WEBSITE_NAME} checks every message against these rules.`}
        >
          <div className="space-y-5">
            <Toggle
              name="enabled"
              label="Enable auto-moderation"
              description="Messages that break a rule are handled automatically."
              defaultChecked={automod.enabled}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Toggle
                name="blockInvites"
                label="Block Discord invites"
                description="Removes messages containing discord.gg links."
                defaultChecked={automod.blockInvites}
              />
              <Toggle
                name="blockExternalLinks"
                label="Block external links"
                description="Removes messages that link to other websites."
                defaultChecked={automod.blockExternalLinks}
              />
            </div>

            <Field
              label="Allowed domains"
              htmlFor="allowedDomains"
              description="Comma separated. When empty every external link is blocked."
            >
              <Input
                name="allowedDomains"
                defaultValue={parseJsonArray(automod.allowedDomains).join(", ")}
                placeholder="github.com, youtube.com"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Toggle
                name="blockCaps"
                label="Block excessive caps"
                description="Triggered when a message is mostly written in capital letters."
                defaultChecked={automod.blockCaps}
              />
              <Field label="Maximum caps percentage" htmlFor="maxCapsPercent">
                <Input
                  name="maxCapsPercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={automod.maxCapsPercent}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Spam message limit" htmlFor="spamMaxMessages">
                <Input
                  name="spamMaxMessages"
                  type="number"
                  min={2}
                  defaultValue={automod.spamMaxMessages}
                />
              </Field>
              <Field label="Spam window (seconds)" htmlFor="spamWindowSeconds">
                <Input
                  name="spamWindowSeconds"
                  type="number"
                  min={1}
                  defaultValue={automod.spamWindowSeconds}
                />
              </Field>
            </div>

            <Field
              label="Banned words"
              htmlFor="bannedWords"
              description="One word or phrase per line."
            >
              <Textarea
                name="bannedWords"
                rows={4}
                defaultValue={parseJsonArray(automod.bannedWords).join("\n")}
                placeholder={"badword\nanother-phrase"}
              />
            </Field>

            <Field
              label="Ignored channels"
              description="Auto-moderation never runs in the selected channels."
            >
              <CheckboxGrid
                name="ignoreChannels"
                options={channelSelect.filter((option) => option.value !== "")}
                defaultValues={parseJsonArray(automod.ignoreChannels)}
                emptyLabel="No text channels available."
              />
            </Field>

            <Field
              label="Ignored roles"
              description="Members with one of these roles are never auto-moderated."
            >
              <CheckboxGrid
                name="ignoreRoles"
                options={roleSelect.filter((option) => option.value !== "")}
                defaultValues={parseJsonArray(automod.ignoreRoles)}
                emptyLabel="No roles available."
              />
            </Field>
          </div>
        </Card>

        <Card title="Actions" description="What happens when a rule is broken.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="External links" htmlFor="actionLink">
              <Select name="actionLink" options={ACTION_OPTIONS} defaultValue={automod.actionLink} />
            </Field>
            <Field label="Spam" htmlFor="actionSpam">
              <Select name="actionSpam" options={ACTION_OPTIONS} defaultValue={automod.actionSpam} />
            </Field>
            <Field label="Banned words" htmlFor="actionWord">
              <Select name="actionWord" options={ACTION_OPTIONS} defaultValue={automod.actionWord} />
            </Field>
            <Field label="Excessive caps" htmlFor="actionCaps">
              <Select name="actionCaps" options={ACTION_OPTIONS} defaultValue={automod.actionCaps} />
            </Field>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label="Warnings before timeout"
              htmlFor="warnLimit"
              description="How many warnings a member gets before the timeout action kicks in."
            >
              <Input name="warnLimit" type="number" min={1} defaultValue={automod.warnLimit} />
            </Field>
            <Field label="Timeout duration (minutes)" htmlFor="timeoutMinutes">
              <Input
                name="timeoutMinutes"
                type="number"
                min={1}
                defaultValue={automod.timeoutMinutes}
              />
            </Field>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4">
          {!context.canManage && (
            <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
          )}
          <SubmitButton disabled={!context.canManage}>Save auto-moderation</SubmitButton>
        </div>
      </form>

      <Card title="Cases" description="The last moderation actions taken in this server.">
        {cases.length === 0 ? (
          <EmptyState
            title="No cases yet"
            description="Ban, kick, timeout and warn actions are recorded here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Case</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Member</th>
                  <th className="pb-3 pr-4 font-medium">Reason</th>
                  <th className="pb-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">#{entry.caseNumber}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={entry.type === "BAN" || entry.type === "KICK" ? "red" : "amber"}>
                        {isCaseType(entry.type) ? CASE_LABELS[entry.type] : entry.type}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{entry.targetTag ?? entry.targetId}</td>
                    <td className="py-3 pr-4 text-slate-400">{entry.reason || "—"}</td>
                    <td className="py-3 text-xs text-slate-500">{relativeTime(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Warnings" description="Active warnings given to members.">
        {warnings.length === 0 ? (
          <EmptyState title="No warnings" description="Warned members are listed here." />
        ) : (
          <ul className="divide-y divide-white/5">
            {warnings.map((warning) => (
              <li key={warning.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <Badge tone="amber">Warning</Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                  {warning.userId} — {warning.reason}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {relativeTime(warning.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-slate-600">
        Log channel:{" "}
        {settings.modLogChannelId ? (
          <span className="text-slate-400">#{channelOptions(channels).find((c) => c.value === settings.modLogChannelId)?.label ?? settings.modLogChannelId}</span>
        ) : (
          <span className="text-slate-400">not configured</span>
        )}{" "}
        — change it on the{" "}
        <Link href={`/dashboard/${guildId}/settings`} className="text-brand-300 hover:text-brand-200">
          settings page
        </Link>
        .
      </p>
    </div>
  );
}
