import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { LIVE_MODES, LIVE_MODE_LABELS, type LiveMode } from "@guardbot/shared";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { invalidateConfigCache } from "../lib/settings";
import { activityMatchesMode, announceLive, findLiveActivity } from "../services/live";
import type { Command } from "../types";

export const liveConfigCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("liveconfig")
    .setDescription("Configure the live / streaming notifications")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set the announcement channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Where announcements are sent")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Set the role that gets pinged")
        .addRoleOption((option) => option.setName("role").setDescription("The role to ping").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("mode")
        .setDescription("Which kind of activity should be announced")
        .addStringOption((option) =>
          option
            .setName("mode")
            .setDescription("live | streaming | both")
            .setRequired(true)
            .addChoices(
              ...LIVE_MODES.map((mode) => ({ name: LIVE_MODE_LABELS[mode], value: mode })),
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable the notifications"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable the notifications"))
    .addSubcommand((sub) => sub.setName("status").setDescription("Show the current configuration"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();

    const settings = await prisma.guildSettings.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { liveChannelId: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Announcement channel updated", `Live announcements go to ${channel}.`)], ephemeral: true });
      return;
    }

    if (sub === "role") {
      const role = interaction.options.getRole("role", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { liveRoleId: role.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Ping role updated", `${role} will be pinged.`)], ephemeral: true });
      return;
    }

    if (sub === "mode") {
      const mode = interaction.options.getString("mode", true) as LiveMode;
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { liveMode: mode } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Mode updated", `Mode: ${LIVE_MODE_LABELS[mode]}`)], ephemeral: true });
      return;
    }

    if (sub === "enable") {
      if (!settings.liveChannelId) {
        await interaction.reply({
          embeds: [errorEmbed("No announcement channel set.", "Use `/liveconfig channel` first.")],
          ephemeral: true,
        });
        return;
      }
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { liveEnabled: true } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Live notifications enabled")], ephemeral: true });
      return;
    }

    if (sub === "disable") {
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { liveEnabled: false } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Live notifications disabled")], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [
        {
          title: "Live notification status",
          color: 0x6366f1,
          fields: [
            { name: "Enabled", value: settings.liveEnabled ? "Yes" : "No", inline: true },
            { name: "Channel", value: settings.liveChannelId ? `<#${settings.liveChannelId}>` : "Not set", inline: true },
            { name: "Ping role", value: settings.liveRoleId ? `<@&${settings.liveRoleId}>` : "Not set", inline: true },
            { name: "Mode", value: LIVE_MODE_LABELS[(settings.liveMode as LiveMode) ?? "both"] ?? "both", inline: true },
          ],
          footer: { text: "GuardBot" },
        },
      ],
      ephemeral: true,
    });
  },
};

export const liveCheckCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("livecheck")
    .setDescription("Scan the server for members who are currently live")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    await interaction.deferReply({ ephemeral: true });

    const settings = await prisma.guildSettings.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    if (!settings.liveEnabled || !settings.liveChannelId) {
      await interaction.editReply({
        embeds: [errorEmbed("Live notifications are disabled.", "Enable them with `/liveconfig enable`.")],
      });
      return;
    }

    const mode = (settings.liveMode as LiveMode) ?? "both";
    const members = await guild.members.fetch({ withPresences: true }).catch(() => null);

    if (!members) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "Could not fetch the members.",
            "The Guild Members and Presence intents must be enabled in the Discord developer portal.",
          ),
        ],
      });
      return;
    }

    let announced = 0;
    for (const member of members.values()) {
      const activity = findLiveActivity(member.presence?.activities ?? []);
      if (!activity) continue;
      if (!activityMatchesMode(activity, mode)) continue;
      const sent = await announceLive(guild, member, activity);
      if (sent) announced += 1;
    }

    await interaction.editReply({
      embeds: [successEmbed("Live scan complete", `${announced} member(s) are live and were announced.`)],
    });
  },
};

export const liveCommands: Command[] = [liveConfigCommand, liveCheckCommand];
