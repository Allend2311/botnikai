import {
  APIEmbed,
  APIEmbedField,
  EmbedBuilder,
  PermissionFlagsBits,
  Colors,
} from "discord.js";

export function baseEmbed(title?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setTimestamp().setFooter({ text: "GuardBot" });
  if (title) embed.setTitle(title);
  return embed;
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(title).setColor(Colors.Green);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(title).setColor(Colors.Red);
  if (description) embed.setDescription(description);
  return embed;
}

export function warnEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(title).setColor(Colors.Yellow);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = baseEmbed(title).setColor(Colors.Blue);
  if (description) embed.setDescription(description);
  return embed;
}

export function field(name: string, value: string, inline = true): APIEmbedField {
  return { name, value: value || "—", inline };
}

export function toApiEmbed(embed: EmbedBuilder): APIEmbed {
  return embed.toJSON();
}

/** Permission bitfield used for the "Add to server" button on the website. */
export const INVITE_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.EmbedLinks |
  PermissionFlagsBits.AttachFiles |
  PermissionFlagsBits.ReadMessageHistory |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.ModerateMembers |
  PermissionFlagsBits.CreateInstantInvite |
  PermissionFlagsBits.MoveMembers |
  PermissionFlagsBits.MuteMembers |
  PermissionFlagsBits.DeafenMembers |
  PermissionFlagsBits.Connect |
  PermissionFlagsBits.UseExternalEmojis |
  PermissionFlagsBits.AddReactions;
