import type { Guild, GuildMember } from "discord.js";
import { applyTemplate } from "@guardbot/shared";
import { baseEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";

export async function sendWelcome(guild: Guild, member: GuildMember): Promise<void> {
  const settings = await getGuildSettings(guild.id);
  if (!settings.welcomeEnabled) return;

  const values = {
    user: `<@${member.id}>`,
    username: member.user.username,
    userid: member.id,
    server: guild.name,
    membercount: guild.memberCount,
  };

  const content = applyTemplate(settings.welcomeMessage, values);

  if (settings.dmOnJoin && settings.welcomeDmMessage) {
    try {
      await member.user.send({ content: applyTemplate(settings.welcomeDmMessage, values) });
    } catch {
      /* the member has DMs closed - ignore */
    }
  }

  const channel = settings.welcomeChannelId ? guild.channels.cache.get(settings.welcomeChannelId) : null;
  if (!channel || !channel.isTextBased()) return;

  const embed = baseEmbed(`Welcome to ${guild.name}!`)
    .setColor(0x6366f1)
    .setDescription(content)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields({ name: "Member count", value: String(guild.memberCount), inline: true });
  if (settings.welcomeImageUrl) embed.setImage(settings.welcomeImageUrl);

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.warn("welcome", `Could not send the welcome message: ${(error as Error).message}`);
  }
}

export async function sendGoodbye(guild: Guild, member: GuildMember | { id: string; user: { username: string; tag: string } }): Promise<void> {
  const settings = await getGuildSettings(guild.id);
  if (!settings.goodbyeEnabled || !settings.goodbyeChannelId) return;

  const channel = guild.channels.cache.get(settings.goodbyeChannelId);
  if (!channel || !channel.isTextBased()) return;

  const userId = member.id;
  const username = member.user.username;
  const tag = "user" in member.user ? member.user.tag : member.user.username;

  const content = applyTemplate(settings.goodbyeMessage, {
    user: `<@${userId}>`,
    username,
    userid: userId,
    server: guild.name,
    membercount: guild.memberCount,
  });

  const embed = baseEmbed(`${username} left the server`)
    .setColor(0x64748b)
    .setDescription(content);
  if (settings.goodbyeImageUrl) embed.setImage(settings.goodbyeImageUrl);

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.warn("welcome", `Could not send the goodbye message: ${(error as Error).message}`);
  }
}
