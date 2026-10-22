import { notFound } from "next/navigation";
import { LIVE_MODES, LIVE_MODE_LABELS, STREAM_PLATFORMS } from "@guardbot/shared";
import {
  addLiveStreamAccount,
  removeLiveStreamAccount,
  saveNotifications,
  testLivePing,
  testPostPing,
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
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MODE_OPTIONS = LIVE_MODES.map((mode) => ({ value: mode, label: LIVE_MODE_LABELS[mode] }));
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Notifications</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Ping your community when a member goes live or publishes a new post.
        </p>
      </div>

      <form action={saveNotifications.bind(null, guildId)} className="space-y-6">
        <Card
          title="Live & streaming announcements"
          description="Posts an embed when somebody starts streaming."
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
              description="Optional. This role is pinged with every announcement."
              options={roleSelect}
              defaultValue={settings.liveRoleId}
            />

            <Toggle
              name="livePingUser"
              label="Ping the member who goes live"
              description="Mentions the streamer in the announcement."
              defaultChecked={settings.livePingUser}
            />

            <Field
              label="What should trigger an announcement?"
              htmlFor="liveMode"
              description="“Going live” only reacts to the built-in Going Live activity."
            >
              <Select name="liveMode" options={MODE_OPTIONS} defaultValue={settings.liveMode} />
            </Field>

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
          description="Reposts new forum posts and channel announcements."
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
              description="Optional. This role is pinged with every announcement."
              options={roleSelect}
              defaultValue={settings.postRoleId}
            />

            <div className="grid gap-5 sm:grid-cols-2">
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
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4">
          {!context.canManage && (
            <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
          )}
          <SubmitButton disabled={!context.canManage}>Save notifications</SubmitButton>
        </div>
      </form>

      <div className="grid gap-6 md:grid-cols-2">
        <Card
          title="Test live ping"
          description="Send a sample live announcement to the configured channel and ping role."
        >
          <form action={testLivePing.bind(null, guildId)}>
            <SubmitButton disabled={!context.canManage}>Send live test</SubmitButton>
          </form>
        </Card>

        <Card
          title="Test post ping"
          description="Send a sample post announcement to the configured channel and ping role."
        >
          <form action={testPostPing.bind(null, guildId)}>
            <SubmitButton disabled={!context.canManage}>Send post test</SubmitButton>
          </form>
        </Card>
      </div>

      <Card
        title="Streaming accounts"
        description="Keep links to your community’s Kick, TikTok, and Facebook Gaming channels here."
      >
        <p className="mb-5 text-sm text-slate-400">
          These profiles are saved for easy access. Automatic live announcements still respond to members’ Discord
          streaming activities; external account live status is not checked.
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
                <form action={removeLiveStreamAccount.bind(null, guildId, account.id)}>
                  <SubmitButton
                    disabled={!context.canManage}
                    className="bg-rose-700 shadow-none hover:bg-rose-600"
                  >
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addLiveStreamAccount.bind(null, guildId)}
          className="grid gap-4 border-t border-white/5 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Field label="Streaming platform" htmlFor="streamAccountPlatform">
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
