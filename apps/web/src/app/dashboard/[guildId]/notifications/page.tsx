import { notFound } from "next/navigation";
import { STREAM_PLATFORMS } from "@guardbot/shared";
import {
  addLiveStreamAccount,
  removeLiveStreamAccount,
  saveNotifications,
} from "@/app/actions";
import {
  channelOptions,
  forumChannels,
  getGuildContext,
  roleOptions,
  textChannels,
} from "@/lib/guild";
import { Card, Field, Input, Select, Toggle } from "@/components/ui";
import { ChannelSelect, RoleSelect } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader, StatusPill } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isBotOwner } from "@/lib/owners";

export const dynamic = "force-dynamic";

const STREAM_PLATFORM_OPTIONS = STREAM_PLATFORMS.map((platform) => ({
  value: platform,
  label: platform,
}));

function streamProfileUrl(platform: string, username: string): string {
  const encodedUsername = encodeURIComponent(username);
  switch (platform) {
    case "Kick":
      return `https://kick.com/${encodedUsername}`;
    case "TikTok":
      return `https://www.tiktok.com/@${encodedUsername}`;
    case "Facebook Gaming":
      return `https://www.facebook.com/${encodedUsername}`;
    default:
      return "#";
  }
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const session = await getSession();
  const isOwner = await isBotOwner(session?.user.discordId);

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Broadcast"
          title="Notifications"
          description="Notify your community when Discord reports a member streaming on Kick or TikTok."
          action={<StatusPill label="Coming soon" tone="cyan" />}
        />

        <Card>
          <div className="flex flex-col items-center justify-center gap-5 py-14 text-center sm:py-20">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-brand-500/20 to-cyan-500/10 text-brand-200 shadow-[0_0_30px_-12px_rgba(129,140,248,0.9)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2" />
              </svg>
            </span>
            <div className="max-w-md">
              <h2 className="text-lg font-semibold text-white">Coming soon</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Live stream and new post notifications are still in development. They will be
                available for your server soon.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const { settings, channels, roles } = context;
  const liveStreamAccounts = await prisma.liveStreamAccount.findMany({
    where: { guildId },
    orderBy: [{ platform: "asc" }, { username: "asc" }],
  });

  const channelSelect = channelOptions(textChannels(channels));
  const forumSelect = channelOptions(forumChannels(channels));
  const roleSelect = roleOptions(roles);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Broadcast"
        title="Notifications"
        description="Notify your community when Discord reports a member streaming on Kick or TikTok."
        action={
          <StatusPill
            label={settings.liveEnabled || settings.postEnabled ? "Signals armed" : "Signals off"}
            tone={settings.liveEnabled || settings.postEnabled ? "emerald" : "amber"}
          />
        }
      />

      <form action={saveNotifications.bind(null, guildId)} className="space-y-6">
        <Card
          title="Kick & TikTok live announcements"
          description="Uses Discord's presence activity and only announces streams whose activity URL is on Kick or TikTok."
        >
          <div className="space-y-5">
            <Toggle
              name="liveEnabled"
              label="Enable live announcements"
              description="Requires the Server Presence intent in the developer portal."
              defaultChecked={settings.liveEnabled}
            />

            <ChannelSelect
              name="liveChannelId"
              label="Announcement channel"
              description="Where the live announcement is posted."
              options={channelSelect}
              defaultValue={settings.liveChannelId}
            />

            <RoleSelect
              name="liveRoleId"
              label="Ping role"
              description="Optional. The role can be pinged alongside @everyone and @here."
              options={roleSelect}
              defaultValue={settings.liveRoleId}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Toggle
                name="livePingEveryone"
                label="Ping @everyone"
                description="Notify everyone in the server when a stream is detected."
                defaultChecked={settings.livePingEveryone}
              />
              <Toggle
                name="livePingHere"
                label="Ping @here"
                description="Notify members who are currently online."
                defaultChecked={settings.livePingHere}
              />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              The bot needs the Mention @everyone, @here, and All Roles permission in the announcement channel for these pings.
            </p>

            <p className="text-xs leading-relaxed text-slate-400">
              No TikTok or Kick API is used. Detection works only when Discord shares the member&apos;s streaming
              activity with a Kick or TikTok URL. Enable Server Presence and Server Members intents for the bot.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <Toggle
                name="liveAnnounceEnd"
                label="Announce when the stream ends"
                defaultChecked={settings.liveAnnounceEnd}
              />
              <Toggle
                name="liveIncludeUrl"
                label="Include the stream link"
                defaultChecked={settings.liveIncludeUrl}
              />
            </div>
          </div>
        </Card>

        <Card
          title="New post notifications"
          description="Reposts new Discord forum/channel posts. External platform videos are not monitored."
        >
          <div className="space-y-5">
            <Toggle
              name="postEnabled"
              label="Enable post notifications"
              defaultChecked={settings.postEnabled}
            />

            <ChannelSelect
              name="postForumChannelId"
              label="Watched forum"
              description="New threads in this forum trigger a notification."
              options={forumSelect}
              defaultValue={settings.postForumChannelId}
            />

            <ChannelSelect
              name="postWatchChannelId"
              label="Watched channel"
              description="Every new message in this channel is announced as well."
              options={channelSelect}
              defaultValue={settings.postWatchChannelId}
            />

            <ChannelSelect
              name="postChannelId"
              label="Announcement channel"
              description="Where the new post announcement is posted."
              options={channelSelect}
              defaultValue={settings.postChannelId}
            />

            <RoleSelect
              name="postRoleId"
              label="Ping role"
              description="Optional. The role can be pinged alongside @everyone and @here."
              options={roleSelect}
              defaultValue={settings.postRoleId}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Toggle
                name="postPingEveryone"
                label="Ping @everyone"
                description="Notify everyone when a new post is announced."
                defaultChecked={settings.postPingEveryone}
              />
              <Toggle
                name="postPingHere"
                label="Ping @here"
                description="Notify members who are currently online."
                defaultChecked={settings.postPingHere}
              />
              <Toggle
                name="postPingAuthor"
                label="Ping the author"
                description="Mentions the member who created the post."
                defaultChecked={settings.postPingAuthor}
              />
              <Toggle
                name="postIncludeContent"
                label="Include a content preview"
                defaultChecked={settings.postIncludeContent}
              />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              The bot needs the Mention @everyone, @here, and All Roles permission in the announcement channel for these pings.
            </p>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4">
          {!context.canManage && (
            <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
          )}
          <SubmitButton disabled={!context.canManage}>Save notifications</SubmitButton>
        </div>
      </form>

      <Card
        title="Streaming accounts"
        description="Save usernames to match against Discord's reported Kick or TikTok live activity."
      >
        <p className="mb-5 text-sm text-slate-400">
          Add the exact Kick or TikTok username. Alerts are sent only when a server member&apos;s Discord Streaming
          activity URL matches one of these accounts. No platform API is used; Discord may not expose every stream URL.
          Latest posts are not monitored without platform data access.
        </p>

        {liveStreamAccounts.length === 0 ? (
          <p className="mb-5 text-sm text-slate-500">No streaming accounts have been added yet.</p>
        ) : (
          <ul className="mb-6 space-y-3">
            {liveStreamAccounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {account.username} <span className="text-slate-400">· {account.platform}</span>
                  </p>
                  <a
                    href={streamProfileUrl(account.platform, account.username)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-300 hover:text-brand-200"
                  >
                    Open profile
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <form action={removeLiveStreamAccount.bind(null, guildId, account.id)}>
                    <SubmitButton disabled={!context.canManage} tone="danger">
                      Remove
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addLiveStreamAccount.bind(null, guildId)}
          className="grid gap-4 border-t border-white/5 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Field label="Streaming platform" htmlFor="streamAccountPlatform" description="Only Kick and TikTok live activity are monitored.">
            <Select
              name="platform"
              id="streamAccountPlatform"
              options={STREAM_PLATFORM_OPTIONS}
              required
            />
          </Field>
          <Field label="Username" htmlFor="streamAccountUsername" description="Enter the account username, not a full URL.">
            <Input
              name="username"
              id="streamAccountUsername"
              placeholder="channelname"
              maxLength={100}
              required
            />
          </Field>
          <SubmitButton disabled={!context.canManage}>Add account</SubmitButton>
        </form>
        {!context.canManage && (
          <p className="mt-3 text-xs text-amber-200">You need the Manage Server permission to edit streaming accounts.</p>
        )}
      </Card>
    </div>
  );
}
