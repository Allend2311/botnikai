import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { invalidateConfigCache } from "../lib/settings";
import { announcePost } from "../services/live";
import type { Command } from "../types";

export const postConfigCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("postconfig")
    .setDescription("Configure the new post notifications")
    .addSubcommand((sub) =>
      sub
        .setName("forum")
        .setDescription("Announce new posts of a forum channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The forum channel")
            .addChannelTypes(ChannelType.GuildForum)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Announce every new message of a channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The post channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("announce")
        .setDescription("Set the channel the announcements are posted in")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The announcement channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Set the role that gets pinged")
        .addRoleOption((option) => option.setName("role").setDescription("The role to ping").setRequired(true)),
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

    if (sub === "forum") {
      const channel = interaction.options.getChannel("channel", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { postForumChannelId: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed("Forum tracked", `New posts in ${channel} will be announced.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "channel") {
      const channel = interaction.options.getChannel("channel", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { postWatchChannelId: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed("Post channel tracked", `New messages in ${channel} will be announced.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "announce") {
      const channel = interaction.options.getChannel("channel", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { postChannelId: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed("Announcement channel updated", `Announcements will be posted in ${channel}.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "role") {
      const role = interaction.options.getRole("role", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { postRoleId: role.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Ping role updated", `${role} will be pinged.`)], ephemeral: true });
      return;
    }

    if (sub === "enable") {
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { postEnabled: true } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Post notifications enabled")], ephemeral: true });
      return;
    }

    if (sub === "disable") {
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { postEnabled: false } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Post notifications disabled")], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [
        {
          title: "Post notification status",
          color: 0x8b5cf6,
          fields: [
            { name: "Enabled", value: settings.postEnabled ? "Yes" : "No", inline: true },
            {
              name: "Forum",
              value: settings.postForumChannelId ? `<#${settings.postForumChannelId}>` : "Not set",
              inline: true,
            },
            {
              name: "Watched channel",
              value: settings.postWatchChannelId ? `<#${settings.postWatchChannelId}>` : "Not set",
              inline: true,
            },
            {
              name: "Announcement channel",
              value: settings.postChannelId ? `<#${settings.postChannelId}>` : "Not set",
              inline: true,
            },
            { name: "Ping role", value: settings.postRoleId ? `<@&${settings.postRoleId}>` : "Not set", inline: true },
          ],
          footer: { text: "GuardBot" },
        },
      ],
      ephemeral: true,
    });
  },
};

export const postTestCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("posttest")
    .setDescription("Send a test post announcement")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const settings = await prisma.guildSettings.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    if (!settings.postEnabled || !settings.postChannelId) {
      await interaction.reply({
        embeds: [errorEmbed("Post notifications are disabled.", "Enable them with `/postconfig enable`.")],
        ephemeral: true,
      });
      return;
    }

    const sent = await announcePost(guild, {
      title: "Test post announcement",
      authorId: interaction.user.id,
      authorTag: interaction.user.tag,
      content: "This is what a new post announcement looks like.",
      url: `https://discord.com/channels/${guild.id}/${interaction.channelId}`,
    });

    await interaction.reply({
      embeds: [sent ? successEmbed("Test sent") : errorEmbed("The announcement could not be sent.")],
      ephemeral: true,
    });
  },
};

export const postCommands: Command[] = [postConfigCommand, postTestCommand];
