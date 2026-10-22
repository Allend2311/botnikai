import {
  ActivityType,
  type Activity,
  type Guild,
  type GuildMember,
} from "discord.js";
import { applyTemplate, type LiveMode } from "@guardbot/shared";
import { baseEmbed, errorEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";

/**
 * Discord represents "Going Live" as a Streaming activity. Some servers use a
 * Custom activity named "Live" instead, so both are supported.
 */
export function findLiveActivity(activities: readonly Activity[]): Activity | undefined {
  return (
    activities.find((activity) => activity.type === ActivityType.Streaming) ??
    activities.find(
      (activity) =>
        activity.type === ActivityType.Custom &&
        typeof activity.name === "string" &&
        activity.name.toLowerCase().includes("live"),
    ) ??
    activities.find(
      (activity) =>
        activity.type === ActivityType.Playing &&
        typeof activity.name === "string" &&
        activity.name.toLowerCase() === "live",
    )
  );
}

export function isLiveActivity(activity: Activity): boolean {
  return activity.type === ActivityType.Streaming || /live/i.test(activity.state ?? "");
}

export function activityMatchesMode(activity: Activity, mode: LiveMode): boolean {
  if (mode === "both") return true;
  if (mode === "live") return isLiveActivity(activity) || activity.type === ActivityType.Custom;
  return activity.type === ActivityType.Streaming;
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

  const mentions = [
    settings.liveRoleId ? `<@&${settings.liveRoleId}>` : "",
    settings.livePingUser ? `<@${member.id}>` : "",
  ].filter(Boolean);

  try {
    await channel.send({
      content: mentions.join(" ") || undefined,
      embeds: [embed],
      allowedMentions: {
        parse: [],
        roles: settings.liveRoleId ? [settings.liveRoleId] : [],
        users: settings.livePingUser ? [member.id] : [],
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

  const mentions = [options.roleId ? `<@&${options.roleId}>` : "", options.pingAuthor ? `<@${options.authorId}>` : ""]
    .filter(Boolean)
    .join(" ");

  try {
    await channel.send({
      content: mentions || undefined,
      embeds: [embed],
      allowedMentions: {
        parse: [],
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
