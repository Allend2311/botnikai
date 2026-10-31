import { cache } from "react";
import { redirect } from "next/navigation";
import type { AutomodConfig, GuildSettings } from "@prisma/client";
import {
  canManageGuild,
  getBotGuild,
  getGuildChannels,
  getGuildRoles,
  getUserGuilds,
  isGuildAdministrator,
  type DiscordChannel,
  type DiscordGuild,
  type DiscordRole,
} from "./discord";
import { prisma } from "./prisma";
import { getSession, SessionExpiredError, withAccessToken } from "./session";

export const DEFAULT_SETTINGS: GuildSettings = {
  guildId: "",
  updatedAt: new Date(0),
  modLogChannelId: null,
  ticketLogChannelId: null,
  activityLogChannelId: null,
  locale: "en-US",
  welcomeEnabled: false,
  welcomeChannelId: null,
  welcomeMessage: "Welcome {user} to {server}! You are member #{membercount}.",
  welcomeImageUrl: null,
  welcomeDmMessage: null,
  dmOnJoin: false,
  autoRoleIds: "[]",
  goodbyeEnabled: false,
  goodbyeChannelId: null,
  goodbyeMessage: "{user} just left the server.",
  goodbyeImageUrl: null,
  roleRequestRoleId: null,
  liveEnabled: false,
  liveChannelId: null,
  liveRoleId: null,
  livePingEveryone: false,
  livePingHere: false,
  livePingUser: true,
  liveMode: "both",
  liveAnnounceEnd: false,
  liveIncludeUrl: true,
  postEnabled: false,
  postForumChannelId: null,
  postWatchChannelId: null,
  postChannelId: null,
  postRoleId: null,
  postPingEveryone: false,
  postPingHere: false,
  postPingAuthor: true,
  postIncludeContent: true,
};

export const DEFAULT_AUTOMOD: AutomodConfig = {
  guildId: "",
  updatedAt: new Date(0),
  enabled: false,
  blockInvites: true,
  blockExternalLinks: false,
  allowedDomains: "[]",
  maxCapsPercent: 50,
  blockCaps: false,
  spamMaxMessages: 5,
  spamWindowSeconds: 7,
  bannedWords: "[]",
  ignoreChannels: "[]",
  ignoreRoles: "[]",
  actionLink: "DELETE",
  actionSpam: "DELETE",
  actionWord: "DELETE",
  actionCaps: "DELETE",
  warnLimit: 3,
  timeoutMinutes: 10,
};

export interface GuildContext {
  guild: DiscordGuild;
  settings: Omit<GuildSettings, "guildId" | "updatedAt">;
  automod: Omit<AutomodConfig, "guildId" | "updatedAt">;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  canManage: boolean;
  canAdmin: boolean;
  isMember: boolean;
}

export const getGuildContext = cache(
  async (guildId: string): Promise<GuildContext | null> => {
    const session = await getSession();
    if (!session) return null;

    const [guild, userGuilds] = await Promise.all([
      getBotGuild(guildId),
      withAccessToken(session, getUserGuilds).catch((error) => {
        if (error instanceof SessionExpiredError) redirect("/?error=session_expired");
        throw error;
      }),
    ]);
    if (!guild) return null;

    const userGuild = userGuilds.find((entry) => entry.id === guildId);

    const [channels, roles, settings, automod] = await Promise.all([
      getGuildChannels(guildId).catch(() => [] as DiscordChannel[]),
      getGuildRoles(guildId).catch(() => [] as DiscordRole[]),
      prisma.guildSettings.findUnique({ where: { guildId } }),
      prisma.automodConfig.findUnique({ where: { guildId } }),
    ]);

    const { guildId: _settingsGuildId, updatedAt: _settingsUpdated, ...restSettings } =
      settings ?? DEFAULT_SETTINGS;
    const { guildId: _automodGuildId, updatedAt: _automodUpdated, ...restAutomod } =
      automod ?? DEFAULT_AUTOMOD;

    return {
      guild,
      settings: restSettings as Omit<GuildSettings, "guildId" | "updatedAt">,
      automod: restAutomod as Omit<AutomodConfig, "guildId" | "updatedAt">,
      channels,
      roles,
      canManage: userGuild ? canManageGuild(userGuild.permissions) : false,
      canAdmin: userGuild ? isGuildAdministrator(userGuild.permissions) : false,
      isMember: Boolean(userGuild),
    };
  },
);

// ---------------------------------------------------------------------------
// Channel helpers
// ---------------------------------------------------------------------------

export const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
} as const;

export function textChannels(channels: DiscordChannel[]): DiscordChannel[] {
  return channels.filter(
    (channel) =>
      channel.type === CHANNEL_TYPE.GUILD_TEXT || channel.type === CHANNEL_TYPE.GUILD_ANNOUNCEMENT,
  );
}

export function forumChannels(channels: DiscordChannel[]): DiscordChannel[] {
  return channels.filter((channel) => channel.type === CHANNEL_TYPE.GUILD_FORUM);
}

export function categoryChannels(channels: DiscordChannel[]): DiscordChannel[] {
  return channels.filter((channel) => channel.type === CHANNEL_TYPE.GUILD_CATEGORY);
}

export function channelOptions(
  channels: DiscordChannel[],
  includeNone = true,
): Array<{ value: string; label: string }> {
  const options = channels.map((channel) => ({
    value: channel.id,
    label: `#${channel.name}`,
  }));

  return includeNone ? [{ value: "", label: "— Not set —" }, ...options] : options;
}

export function roleOptions(
  roles: DiscordRole[],
  includeNone = true,
): Array<{ value: string; label: string }> {
  const options = [...roles]
    .sort((a, b) => b.position - a.position)
    .filter((role) => role.name !== "@everyone")
    .map((role) => ({ value: role.id, label: role.name }));

  return includeNone ? [{ value: "", label: "— Not set —" }, ...options] : options;
}

// ---------------------------------------------------------------------------
// JSON helpers for the string backed columns
// ---------------------------------------------------------------------------

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function channelName(channels: DiscordChannel[], id: string | null | undefined): string {
  if (!id) return "—";
  return channels.find((channel) => channel.id === id)?.name ?? id;
}

export function roleName(roles: DiscordRole[], id: string | null | undefined): string {
  if (!id) return "—";
  return roles.find((role) => role.id === id)?.name ?? id;
}
