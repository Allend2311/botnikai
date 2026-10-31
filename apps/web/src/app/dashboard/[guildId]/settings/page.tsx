import { notFound } from "next/navigation";
import { WEBSITE_NAME } from "@/lib/brand";
import { saveGeneralSettings } from "@/app/actions";
import { channelOptions, getGuildContext, textChannels } from "@/lib/guild";
import { inviteUrl } from "@/lib/discord";
import { Card, Field, Input } from "@/components/ui";
import { ChannelSelect } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const { settings, guild, channels } = context;
  const channelSelect = channelOptions(textChannels(channels));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Logging destinations and general information about this server."
      />

      <form action={saveGeneralSettings.bind(null, guildId)} className="space-y-6">
        <Card title="Log channels" description={`Where ${WEBSITE_NAME} writes its activity.`}>
          <div className="space-y-5">
            <ChannelSelect
              name="modLogChannelId"
              label="Moderation log"
              description="Bans, kicks, timeouts, warnings and auto-mod actions."
              options={channelSelect}
              defaultValue={settings.modLogChannelId}
            />
            <ChannelSelect
              name="ticketLogChannelId"
              label="Ticket log"
              description="Tickets that are opened and closed."
              options={channelSelect}
              defaultValue={settings.ticketLogChannelId}
            />
            <ChannelSelect
              name="activityLogChannelId"
              label="Activity log"
              description="Live announcements, new posts and other server activity."
              options={channelSelect}
              defaultValue={settings.activityLogChannelId}
            />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4">
          {!context.canManage && (
            <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
          )}
          <SubmitButton disabled={!context.canManage}>Save settings</SubmitButton>
        </div>
      </form>

      <Card title="Server" description="Information fetched from Discord.">
        <dl className="divide-y divide-white/[0.06]">
          {[
            { label: "Name", value: guild.name, mono: false },
            { label: "Server ID", value: guild.id, mono: true },
            { label: "Members", value: (guild.approximate_member_count ?? 0).toLocaleString(), mono: false },
            {
              label: "Your access",
              value: context.isMember
                ? context.canManage
                  ? "Manage Server"
                  : "Member (read only)"
                : "Not a member",
              mono: false,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <dt className="text-xs text-slate-500 sm:text-sm">{row.label}</dt>
              <dd
                className={`break-all text-xs text-slate-200 sm:text-right sm:text-sm ${
                  row.mono ? "font-mono text-slate-400" : ""
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Bot" description="Keep the bot connected with the right permissions.">
        <div className="space-y-4">
          <Field
            label={`Re-invite ${WEBSITE_NAME}`}
            htmlFor="invite"
            description="Use this link if a permission is missing or you want to move the bot to another server."
          >
            <Input name="invite" readOnly value={inviteUrl()} className="font-mono text-xs" />
          </Field>
          <p className="text-xs leading-relaxed text-slate-500">
            Make sure the <span className="text-slate-300">Server Members</span>,{" "}
            <span className="text-slate-300">Server Presence</span> and{" "}
            <span className="text-slate-300">Message Content</span> intents are enabled in the
            Discord developer portal — otherwise welcome messages, live detection and auto-mod stay
            silent.
          </p>
          <p className="text-xs text-slate-600">{WEBSITE_NAME} · dashboard</p>
        </div>
      </Card>
    </div>
  );
}
