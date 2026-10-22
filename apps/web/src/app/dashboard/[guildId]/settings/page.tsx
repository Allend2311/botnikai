import { notFound } from "next/navigation";
import { WEBSITE_NAME } from "@/lib/brand";
import { saveGeneralSettings } from "@/app/actions";
import { channelOptions, getGuildContext, textChannels } from "@/lib/guild";
import { inviteUrl } from "@/lib/discord";
import { Card, Field, Input } from "@/components/ui";
import { ChannelSelect } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Logging destinations and general information about this server.
        </p>
      </div>

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
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Name</dt>
            <dd className="text-slate-200">{guild.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Server ID</dt>
            <dd className="font-mono text-xs text-slate-400">{guild.id}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Members</dt>
            <dd className="text-slate-200">{guild.approximate_member_count ?? 0}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Your access</dt>
            <dd className="text-slate-200">
              {context.isMember
                ? context.canManage
                  ? "Manage Server"
                  : "Member (read only)"
                : "Not a member"}
            </dd>
          </div>
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
