import {
  ActivityType,
  type Activity,
  type Guild,
  type GuildMember,
} from "discord.js";
import { applyTemplate } from "@guardbot/shared";
import { baseEmbed, errorEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";

interface LiveStreamAccountProfile {
  platform: string;
  username: string;
}

function getLiveStreamPlatform(activity: Activity): "Kick" | "TikTok" | null {
  if (activity.type !== ActivityType.Streaming || !activity.url) return null;

  try {
    const hostname = new URL(activity.url).hostname.toLowerCase();
    if (hostname === "kick.com" || hostname.endsWith(".kick.com")) return "Kick";
    if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) return "TikTok";
    return null;
  } catch {
    return null;
  }
}

function getLiveStreamUsername(activity: Activity, platform: "Kick" | "TikTok"): string | null {
  if (!activity.url) return null;
  try {
    const pathname = new URL(activity.url).pathname;
    const match = platform === "TikTok" ? pathname.match(/^\/@([^/]+)/) : pathname.match(/^\/([^/]+)/);
    return match?.[1]?.replace(/^@/, "").toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function matchesConfiguredAccount(activity: Activity, accounts: readonly LiveStreamAccountProfile[]): boolean {
  const platform = getLiveStreamPlatform(activity);
  if (!platform) return false;

  const username = getLiveStreamUsername(activity, platform);
  if (!username) return false;

  return accounts.some(
    (account) =>
      account.platform === platform &&
      account.username.replace(/^@+/, "").toLowerCase() === username,
  );
}

export function findLiveActivity(
  activities: readonly Activity[],
  accounts: readonly LiveStreamAccountProfile[],
): Activity | undefined {
  return activities.find((activity) => matchesConfiguredAccount(activity, accounts));
}

export function activityUrl(activity: Activity): string | null {
  const url = activity.url ?? null;
  if (!url) return null;
  return url.startsWith("http") ? url : null;
}

export async function announceLive(guild: Guild, member: GuildMember, activity: Activity): Promise<boolean> {
  const settings = await getGuildSettings(guild.id);
  if (!settings.liveEnabled || !settings.liveChannelId) return false;

  const channel = guild.channels.cache.get(settings.liveChannelId);
  if (!channel || !channel.isTextBased()) return false;

  const url = activityUrl(activity);
  const embed = baseEmbed(`${member.user.username} is now live!`)
    .setColor(0xef4444)
    .setDescription(
      applyTemplate("**{user}** just went live on **{server}**.", {
        user: `<@${member.id}>`,
        server: guild.name,
      }),
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  if (activity.name) embed.addFields({ name: "Platform", value: String(activity.name), inline: true });
  if (activity.details) embed.addFields({ name: "Title", value: String(activity.details), inline: false });
  if (activity.state) embed.addFields({ name: "Status", value: String(activity.state), inline: true });
  if (url && settings.liveIncludeUrl) embed.setURL(url);

  const broadcastMentions = [
    settings.livePingEveryone ? "@everyone" : "",
    settings.livePingHere ? "@here" : "",
  ].filter(Boolean);

  try {
    await channel.send({
      content: [
        settings.liveRoleId ? `<@&${settings.liveRoleId}>` : "",
        ...broadcastMentions,
      ].filter(Boolean).join(" ") || undefined,
      embeds: [embed],
      allowedMentions: {
        parse: broadcastMentions.length > 0 ? ["everyone"] : [],
        roles: settings.liveRoleId ? [settings.liveRoleId] : [],
        users: [],
      },
    });
    return true;
  } catch (error) {
    logger.warn("live", `Could not send the live announcement: ${(error as Error).message}`);
    return false;
  }
}

export async function announceLiveEnded(guild: Guild, member: GuildMember, activity: Activity | undefined): Promise<boolean> {
  const settings = await getGuildSettings(guild.id);
  if (!settings.liveEnabled || !settings.liveChannelId || !settings.liveAnnounceEnd) return false;

  const channel = guild.channels.cache.get(settings.liveChannelId);
  if (!channel || !channel.isTextBased()) return false;

  const embed = baseEmbed(`${member.user.username} is no longer live`)
    .setColor(0x64748b)
    .setDescription(`**${member.user.tag}** ended their stream.`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }));

  if (activity?.name) embed.addFields({ name: "Platform", value: String(activity.name), inline: true });

  try {
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    logger.warn("live", `Could not send the stream-ended announcement: ${(error as Error).message}`);
    return false;
  }
}

export async function announcePost(guild: Guild, options: {
  title: string;
  authorId: string;
  authorTag: string;
  content?: string;
  url: string;
  avatarUrl?: string;
  roleId?: string | null;
  pingAuthor?: boolean;
  pingEveryone?: boolean;
  pingHere?: boolean;
}): Promise<boolean> {
  const settings = await getGuildSettings(guild.id);
  if (!settings.postEnabled || !settings.postChannelId) return false;

  const channel = guild.channels.cache.get(settings.postChannelId);
  if (!channel || !channel.isTextBased()) return false;

  const embed = baseEmbed(options.title)
    .setColor(0x8b5cf6)
    .setTimestamp()
    .setURL(options.url);

  if (options.avatarUrl) embed.setThumbnail(options.avatarUrl);
  embed.addFields({ name: "Author", value: options.authorTag, inline: true });
  if (options.content) embed.setDescription(options.content);

  const broadcastMentions = [
    options.pingEveryone ? "@everyone" : "",
    options.pingHere ? "@here" : "",
  ].filter(Boolean);
  const mentions = [
    options.roleId ? `<@&${options.roleId}>` : "",
    ...broadcastMentions,
    options.pingAuthor ? `<@${options.authorId}>` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    await channel.send({
      content: mentions || undefined,
      embeds: [embed],
      allowedMentions: {
        parse: broadcastMentions.length > 0 ? ["everyone"] : [],
        roles: options.roleId ? [options.roleId] : [],
        users: options.pingAuthor ? [options.authorId] : [],
      },
    });
    return true;
  } catch (error) {
    logger.warn("posts", `Could not send the post announcement: ${(error as Error).message}`);
    return false;
  }
}

export { errorEmbed };
