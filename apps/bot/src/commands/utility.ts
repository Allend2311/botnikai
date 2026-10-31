import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, type GuildBasedChannel, type Role } from "discord.js";
import { APP_NAME } from "@guardbot/shared";
import { prisma } from "../lib/db";
import { errorEmbed, infoEmbed, INVITE_PERMISSIONS, successEmbed } from "../lib/embeds";
import { isBotOwner } from "../lib/owners";
import type { Command } from "../types";
import { moderationCommands } from "./moderation";
import { welcomeCommands } from "./welcome";
import { ticketCommands } from "./tickets";
import { liveCommands } from "./live";
import { postCommands } from "./posts";
import { roleRequestCommands } from "./roleRequests";
import { announcementCommands } from "./announcement";
import { broadcastCommands } from "./broadcast";
import { configCommands } from "./config";

const POLL_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check if the bot is alive"),
  adminOnly: false,
  async execute({ interaction }) {
    await interaction.reply({ content: `🏓 Pong! \`${Math.round(interaction.client.ws.ping)}ms\``, ephemeral: true });
  },
};

export const helpCommand: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("Show every command"),
  adminOnly: false,
  async execute({ interaction }) {
    const groups = [
      { name: "Moderation", commands: moderationCommands },
      { name: "Welcome & roles", commands: welcomeCommands },
      { name: "Tickets", commands: ticketCommands },
      { name: "Live notifications", commands: liveCommands },
      { name: "Post notifications", commands: postCommands },
      { name: "Role requests", commands: roleRequestCommands },
      { name: "Announcements", commands: announcementCommands },
      { name: "Configuration", commands: configCommands },
      { name: "Utility", commands: utilityCommands },
    ];

    // The owner group is only visible to the bot owner.
    if (await isBotOwner(interaction.client, interaction.user.id)) {
      groups.push({ name: "Owner", commands: broadcastCommands });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${APP_NAME} commands`)
      .setColor(0x6366f1)
      .setFooter({ text: "Manage everything from the dashboard at " + (process.env.APP_URL ?? "http://localhost:3000") });

    for (const group of groups) {
      const lines = group.commands.map((command) => `\`/${command.data.name}\` — ${command.data.description}`);
      embed.addFields({ name: group.name, value: lines.join("\n"), inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const inviteCommand: Command = {
  data: new SlashCommandBuilder().setName("invite").setDescription("Get the invite link of the bot"),
  adminOnly: false,
  async execute({ interaction }) {
    const clientId = interaction.client.user?.id;
    if (!clientId) {
      await interaction.reply({ embeds: [errorEmbed("The invite link is not available right now.")], ephemeral: true });
      return;
    }

    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${INVITE_PERMISSIONS}&scope=bot%20applications.commands`;
    await interaction.reply({ embeds: [infoEmbed("Add me to your server", url)], ephemeral: true });
  },
};

export const statsCommand: Command = {
  data: new SlashCommandBuilder().setName("stats").setDescription("Show the bot statistics"),
  adminOnly: false,
  async execute({ interaction, guild }) {
    const guildCount = await prisma.guild.count();
    const caseCount = await prisma.case.count();
    const ticketCount = await prisma.ticket.count();
    const warningCount = await prisma.warning.count();

    const embed = new EmbedBuilder()
      .setTitle(`${APP_NAME} statistics`)
      .setColor(0x6366f1)
      .addFields(
        { name: "Servers", value: String(guildCount), inline: true },
        { name: "Moderation cases", value: String(caseCount), inline: true },
        { name: "Warnings", value: String(warningCount), inline: true },
        { name: "Tickets", value: String(ticketCount), inline: true },
        { name: "Websocket ping", value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true },
        { name: "Uptime", value: formatUptime(interaction.client.uptime ?? 0), inline: true },
        { name: "Current server", value: guild ? `${guild.name} (${guild.memberCount} members)` : "DM", inline: true },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const userInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a member")
    .addUserOption((option) => option.setName("user").setDescription("The member (defaults to you)")),
  adminOnly: false,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = await guild.members.fetch(user.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setColor(member?.displayColor || 0x6366f1)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Id", value: `\`${user.id}\``, inline: true },
        { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
        { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      );

    if (member) {
      const roles = member.roles.cache
        .filter((role) => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => `<@&${role.id}>`)
        .slice(0, 20)
        .join(" ");

      embed.addFields(
        { name: "Nickname", value: member.nickname ?? "None", inline: true },
        { name: "Joined", value: `<t:${Math.floor(member.joinedTimestamp ?? 0) / 1000 || 0}:R>`, inline: true },
        {
          name: "Timed out until",
          value: member.communicationDisabledUntilTimestamp
            ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>`
            : "Not timed out",
          inline: true,
        },
        { name: `Roles (${member.roles.cache.size - 1})`, value: roles || "None", inline: false },
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const serverInfoCommand: Command = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("Show information about this server"),
  adminOnly: false,
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const owner = await guild.fetchOwner().catch(() => null);
    const members = await guild.members.fetch().catch(() => null);
    const bots = members?.filter((member) => member.user.bot).size;
    const humans = members ? members.size - (bots ?? 0) : undefined;

    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setColor(0x6366f1)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: "Owner", value: owner ? `${owner}` : `<@${guild.ownerId}>`, inline: true },
        { name: "Server id", value: `\`${guild.id}\``, inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Members", value: String(guild.memberCount), inline: true },
        { name: "Humans", value: humans != null ? String(humans) : "—", inline: true },
        { name: "Bots", value: bots != null ? String(bots) : "—", inline: true },
        { name: "Channels", value: String(guild.channels.cache.size), inline: true },
        { name: "Roles", value: String(guild.roles.cache.size), inline: true },
        { name: "Boost tier", value: `Tier ${guild.premiumTier}`, inline: true },
        { name: "Boosts", value: String(guild.premiumSubscriptionCount ?? 0), inline: true },
        { name: "Verification", value: ["None", "Low", "Medium", "High", "Highest"][guild.verificationLevel] ?? String(guild.verificationLevel), inline: true },
        { name: "Locale", value: guild.preferredLocale, inline: true },
      )
      .setFooter({ text: "GuardBot" });

    if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const avatarCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show the avatar of a member")
    .addUserOption((option) => option.setName("user").setDescription("The member (defaults to you)")),
  adminOnly: false,
  async execute({ interaction, guild }) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = guild ? await guild.members.fetch(user.id).catch(() => null) : null;

    const avatar = user.displayAvatarURL({ size: 1024 });
    const serverAvatar = member && member.displayAvatarURL({ size: 1024 }) !== avatar
      ? member.displayAvatarURL({ size: 1024 })
      : null;

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s avatar`)
      .setColor(member?.displayColor || 0x6366f1)
      .setImage(serverAvatar ?? avatar)
      .addFields(
        { name: "User", value: `${user}`, inline: true },
        { name: "Global avatar", value: `[Open](${avatar})`, inline: true },
      );

    if (serverAvatar) embed.addFields({ name: "Server avatar", value: `[Open](${serverAvatar})`, inline: true });

    await interaction.reply({ embeds: [embed] });
  },
};

export const bannerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("banner")
    .setDescription("Show the profile banner of a member")
    .addUserOption((option) => option.setName("user").setDescription("The member (defaults to you)")),
  adminOnly: false,
  async execute({ interaction }) {
    const selected = interaction.options.getUser("user") ?? interaction.user;
    const user = await interaction.client.users.fetch(selected.id, { force: true }).catch(() => selected);
    const banner = user.bannerURL({ size: 1024 });

    if (!banner) {
      await interaction.reply({ embeds: [errorEmbed("No banner", `${user.username} does not have a profile banner.`)], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s banner`)
      .setColor(0x6366f1)
      .setImage(banner)
      .addFields({ name: "User", value: `${user}`, inline: true }, { name: "Download", value: `[Open](${banner})`, inline: true });

    await interaction.reply({ embeds: [embed] });
  },
};

export const memberCountCommand: Command = {
  data: new SlashCommandBuilder().setName("membercount").setDescription("Show how many members this server has"),
  adminOnly: false,
  guildOnly: true,
  defer: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const members = await guild.members.fetch({ withPresences: true }).catch(() => null);
    const bots = members?.filter((member) => member.user.bot).size ?? 0;
    const online = members?.filter((member) => member.presence?.status !== "offline").size ?? 0;

    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} member count`)
      .setColor(0x6366f1)
      .addFields(
        { name: "Total", value: String(guild.memberCount), inline: true },
        { name: "Humans", value: members ? String(members.size - bots) : "—", inline: true },
        { name: "Bots", value: members ? String(bots) : "—", inline: true },
        { name: "Online", value: members ? String(online) : "—", inline: true },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.editReply({ embeds: [embed] });
  },
};

export const botInfoCommand: Command = {
  data: new SlashCommandBuilder().setName("botinfo").setDescription("Show information about the bot"),
  adminOnly: false,
  async execute({ interaction }) {
    const client = interaction.client;
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;

    const embed = new EmbedBuilder()
      .setTitle(`${APP_NAME} info`)
      .setColor(0x6366f1)
      .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) ?? null)
      .addFields(
        { name: "Servers", value: String(client.guilds.cache.size), inline: true },
        { name: "Users", value: String(client.users.cache.size), inline: true },
        { name: "Commands", value: String(client.commands.size), inline: true },
        { name: "Uptime", value: formatUptime(client.uptime ?? 0), inline: true },
        { name: "Ping", value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: "Memory", value: `${memory.toFixed(1)} MB`, inline: true },
        { name: "Node", value: process.version, inline: true },
        { name: "Library", value: "discord.js v14", inline: true },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const roleInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Show information about a role")
    .addRoleOption((option) => option.setName("role").setDescription("The role").setRequired(true)),
  adminOnly: false,
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const role = interaction.options.getRole("role", true) as Role;

    const permissions = role.permissions.toArray();
    const shown = permissions.slice(0, 15).map((permission) => permission.replaceAll("_", " ").toLowerCase());
    if (permissions.length > shown.length) shown.push(`+${permissions.length - shown.length} more`);

    const embed = new EmbedBuilder()
      .setTitle(role.name)
      .setColor(role.color || 0x6366f1)
      .addFields(
        { name: "Id", value: `\`${role.id}\``, inline: true },
        { name: "Color", value: role.hexColor, inline: true },
        { name: "Members", value: String(role.members.size), inline: true },
        { name: "Position", value: String(role.position), inline: true },
        { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
        { name: "Hoisted", value: role.hoist ? "Yes" : "No", inline: true },
        { name: "Created", value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "Permissions", value: shown.length > 0 ? shown.join(", ") : "None", inline: false },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const channelInfoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("channelinfo")
    .setDescription("Show information about a channel")
    .addChannelOption((option) => option.setName("channel").setDescription("The channel (defaults to this one)")),
  adminOnly: false,
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const selected = interaction.options.getChannel("channel") ?? interaction.channel;
    const channel = selected as GuildBasedChannel | null;
    if (!channel || !("guild" in channel) || !channel.guild) {
      await interaction.reply({ embeds: [errorEmbed("This is not a server channel.")], ephemeral: true });
      return;
    }

    const details: Array<{ name: string; value: string; inline: boolean }> = [
      { name: "Id", value: `\`${channel.id}\``, inline: true },
      { name: "Type", value: ChannelType[channel.type] ?? String(channel.type), inline: true },
      { name: "Created", value: channel.createdTimestamp ? `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>` : "—", inline: true },
      { name: "Category", value: "parent" in channel ? channel.parent?.name ?? "None" : "None", inline: true },
      { name: "Position", value: "position" in channel ? String(channel.position) : "—", inline: true },
    ];

    if ("topic" in channel && channel.topic) {
      details.push({ name: "Topic", value: channel.topic.slice(0, 1000), inline: false });
    }
    if ("nsfw" in channel) {
      details.push({ name: "Age restricted", value: channel.nsfw ? "Yes" : "No", inline: true });
    }
    if ("rateLimitPerUser" in channel) {
      details.push({ name: "Slowmode", value: `${channel.rateLimitPerUser ?? 0}s`, inline: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`#${channel.name}`)
      .setColor(0x6366f1)
      .addFields(details)
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const pollCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll with up to five options")
    .addStringOption((option) => option.setName("question").setDescription("The poll question").setRequired(true).setMaxLength(200))
    .addStringOption((option) => option.setName("option-1").setDescription("First option").setRequired(true).setMaxLength(80))
    .addStringOption((option) => option.setName("option-2").setDescription("Second option").setRequired(true).setMaxLength(80))
    .addStringOption((option) => option.setName("option-3").setDescription("Third option").setMaxLength(80))
    .addStringOption((option) => option.setName("option-4").setDescription("Fourth option").setMaxLength(80))
    .addStringOption((option) => option.setName("option-5").setDescription("Fifth option").setMaxLength(80)),
  adminOnly: false,
  guildOnly: true,
  async execute({ interaction }) {
    const question = interaction.options.getString("question", true);
    const options = [1, 2, 3, 4, 5]
      .map((index) => interaction.options.getString(`option-${index}`))
      .filter((value): value is string => Boolean(value && value.trim()));

    const embed = new EmbedBuilder()
      .setTitle("📊 " + question)
      .setColor(0x6366f1)
      .setDescription(options.map((option, index) => `${POLL_EMOJIS[index]} ${option}`).join("\n\n"))
      .setFooter({ text: `Poll by ${interaction.user.tag}` });

    await interaction.reply({ embeds: [embed] });
    const message = await interaction.fetchReply();
    for (const emoji of POLL_EMOJIS.slice(0, options.length)) {
      await message.react(emoji).catch(() => undefined);
    }
  },
};

export const sayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Send a plain message as the bot")
    .addStringOption((option) => option.setName("message").setDescription("The message to send").setRequired(true).setMaxLength(2000))
    .addChannelOption((option) => option.setName("channel").setDescription("Where to send it (defaults to this channel)"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  adminOnly: false,
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.SendMessages],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const message = interaction.options.getString("message", true);
    const selected = interaction.options.getChannel("channel");

    const channel = selected
      ? await guild.channels.fetch(selected.id).catch(() => null)
      : interaction.channel;

    if (!channel || !channel.isTextBased() || channel.isDMBased() || !("send" in channel)) {
      await interaction.reply({ embeds: [errorEmbed("Choose a text channel.")], ephemeral: true });
      return;
    }

    await channel.send({ content: message, allowedMentions: { parse: [] } });
    await interaction.reply({ embeds: [successEmbed("Message sent", `Sent in ${channel}.`)], ephemeral: true });
  },
};

export const embedCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Send a custom embed")
    .addStringOption((option) => option.setName("title").setDescription("Embed title").setRequired(true).setMaxLength(256))
    .addStringOption((option) => option.setName("description").setDescription("Embed body").setRequired(true).setMaxLength(4000))
    .addChannelOption((option) =>
      option.setName("channel").setDescription("Where to send it (defaults to this channel)").addChannelTypes(ChannelType.GuildText),
    )
    .addStringOption((option) => option.setName("color").setDescription("Hex color such as #6366f1"))
    .addStringOption((option) => option.setName("image-url").setDescription("Public HTTPS image URL"))
    .addStringOption((option) => option.setName("thumbnail-url").setDescription("Public HTTPS thumbnail URL"))
    .addStringOption((option) => option.setName("footer").setDescription("Footer text").setMaxLength(2048))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  adminOnly: false,
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const title = interaction.options.getString("title", true);
    const description = interaction.options.getString("description", true);
    const colorInput = interaction.options.getString("color");
    const image = interaction.options.getString("image-url");
    const thumbnail = interaction.options.getString("thumbnail-url");
    const footer = interaction.options.getString("footer");
    const selected = interaction.options.getChannel("channel");

    let color = 0x6366f1;
    if (colorInput) {
      if (!/^#?[0-9a-f]{6}$/i.test(colorInput.trim())) {
        await interaction.reply({ embeds: [errorEmbed("Invalid color", "Use a six digit hex color such as `#6366f1`.")], ephemeral: true });
        return;
      }
      color = Number.parseInt(colorInput.replace("#", ""), 16);
    }

    for (const [label, url] of [["image", image], ["thumbnail", thumbnail]] as const) {
      if (!url) continue;
      try {
        if (new URL(url).protocol !== "https:") throw new Error("HTTPS required");
      } catch {
        await interaction.reply({ embeds: [errorEmbed(`Invalid ${label} URL`, "Use a public HTTPS URL.")], ephemeral: true });
        return;
      }
    }

    const channel = selected ? await guild.channels.fetch(selected.id).catch(() => null) : interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased() || !("send" in channel)) {
      await interaction.reply({ embeds: [errorEmbed("Choose a text channel.")], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: footer ?? "GuardBot" });
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);

    await channel.send({ embeds: [embed] });
    await interaction.reply({ embeds: [successEmbed("Embed sent", `Sent in ${channel}.`)], ephemeral: true });
  },
};

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds % 60}s`);
  return parts.join(" ");
}

export const utilityCommands: Command[] = [
  pingCommand,
  helpCommand,
  inviteCommand,
  statsCommand,
  userInfoCommand,
  serverInfoCommand,
  avatarCommand,
  bannerCommand,
  memberCountCommand,
  botInfoCommand,
  roleInfoCommand,
  channelInfoCommand,
  pollCommand,
  sayCommand,
  embedCommand,
];
