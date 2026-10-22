import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { APP_NAME } from "@guardbot/shared";
import { prisma } from "../lib/db";
import { errorEmbed, infoEmbed, INVITE_PERMISSIONS } from "../lib/embeds";
import type { Command } from "../types";
import { moderationCommands } from "./moderation";
import { welcomeCommands } from "./welcome";
import { ticketCommands } from "./tickets";
import { liveCommands } from "./live";
import { postCommands } from "./posts";
import { roleRequestCommands } from "./roleRequests";
import { announcementCommands } from "./announcement";

export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check if the bot is alive"),
  async execute({ interaction }) {
    await interaction.reply({ content: `🏓 Pong! \`${Math.round(interaction.client.ws.ping)}ms\``, ephemeral: true });
  },
};

export const helpCommand: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("Show every command"),
  async execute({ interaction }) {
    const groups = [
      { name: "Moderation", commands: moderationCommands },
      { name: "Welcome & roles", commands: welcomeCommands },
      { name: "Tickets", commands: ticketCommands },
      { name: "Live notifications", commands: liveCommands },
      { name: "Post notifications", commands: postCommands },
      { name: "Role requests", commands: roleRequestCommands },
      { name: "Announcements", commands: announcementCommands },
      { name: "Utility", commands: [pingCommand, helpCommand, inviteCommand, statsCommand] },
    ];

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
  async execute({ interaction, guild }) {
    const guildCount = await prisma.guild.count();
    const caseCount = await prisma.case.count();
    const ticketCount = await prisma.ticket.count();

    const embed = new EmbedBuilder()
      .setTitle(`${APP_NAME} statistics`)
      .setColor(0x6366f1)
      .addFields(
        { name: "Servers", value: String(guildCount), inline: true },
        { name: "Moderation cases", value: String(caseCount), inline: true },
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
    .addUserOption((option) => option.setName("user").setDescription("The member").setRequired(true)),
  async execute({ interaction, guild }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const member = await guild.members.fetch(user.id).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle(user.tag)
      .setColor(0x6366f1)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Id", value: user.id, inline: true },
        { name: "Bot", value: user.bot ? "Yes" : "No", inline: true },
        { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      );

    if (member) {
      embed.addFields(
        {
          name: "Roles",
          value: member.roles.cache
            .filter((role) => role.id !== guild.id)
            .map((role) => `<@&${role.id}>`)
            .join(" ") || "None",
          inline: false,
        },
        { name: "Joined", value: `<t:${Math.floor(member.joinedTimestamp ?? 0) / 1000 || 0}:R>`, inline: true },
        { name: "Timed out until", value: member.communicationDisabledUntilTimestamp ? `<t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:R>` : "Not timed out", inline: true },
      );
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
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

export const utilityCommands: Command[] = [pingCommand, helpCommand, inviteCommand, statsCommand, userInfoCommand];
