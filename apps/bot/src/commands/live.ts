import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { invalidateConfigCache } from "../lib/settings";
import { announceLive, findLiveActivity } from "../services/live";
import type { Command } from "../types";

export const liveConfigCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("liveconfig")
    .setDescription("Configure Kick and TikTok live notifications")
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
        .setName("everyone")
        .setDescription("Toggle @everyone on live announcements")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enable the ping").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("here")
        .setDescription("Toggle @here on live announcements")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enable the ping").setRequired(true)),
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

    if (sub === "everyone" || sub === "here") {
      const enabled = interaction.options.getBoolean("enabled", true);
      const field = sub === "everyone" ? "livePingEveryone" : "livePingHere";
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { [field]: enabled } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed(`${sub === "everyone" ? "@everyone" : "@here"} ping ${enabled ? "enabled" : "disabled"}`)],
        ephemeral: true,
      });
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
            { name: "@everyone", value: settings.livePingEveryone ? "Enabled" : "Disabled", inline: true },
            { name: "@here", value: settings.livePingHere ? "Enabled" : "Disabled", inline: true },
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
    .setDescription("Scan for members with detected Kick or TikTok streams")
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

    const accounts = await prisma.liveStreamAccount.findMany({
      where: { guildId: guild.id, platform: { in: ["Kick", "TikTok"] } },
      select: { platform: true, username: true },
    });

    let announced = 0;
    for (const member of members.values()) {
      const activity = findLiveActivity(member.presence?.activities ?? [], accounts);
      if (!activity) continue;
      const sent = await announceLive(guild, member, activity);
      if (sent) announced += 1;
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          "Live scan complete",
          `${announced} member(s) with a detected Kick or TikTok streaming activity were announced.`,
        ),
      ],
    });
  },
};

export const liveCommands: Command[] = [liveConfigCommand, liveCheckCommand];
