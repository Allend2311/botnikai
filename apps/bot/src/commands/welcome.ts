import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type GuildMember } from "discord.js";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { invalidateConfigCache } from "../lib/settings";
import { sendWelcome } from "../services/welcome";
import type { Command } from "../types";

export const welcomeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configure the welcome message")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set the channel where welcome messages are sent")
        .addChannelOption((option) =>
          option.setName("channel").setDescription("The welcome channel").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription("Set the welcome message template")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Use {user}, {username}, {userid}, {server}, {membercount}")
            .setRequired(true)
            .setMaxLength(2000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("image")
        .setDescription("Set or clear the welcome image or GIF")
        .addStringOption((option) =>
          option.setName("url").setDescription("Public HTTPS image or GIF URL (leave empty to clear)"),
        ),
    )
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable welcome messages"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable welcome messages"))
    .addSubcommand((sub) => sub.setName("test").setDescription("Send a test welcome message"))
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
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { welcomeChannelId: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed("Welcome channel updated", `Welcome messages will be sent to ${channel}.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "message") {
      const message = interaction.options.getString("message", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { welcomeMessage: message } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed("Welcome message updated", `Template: ${message}`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "image") {
      const imageUrl = interaction.options.getString("url");
      if (imageUrl) {
        let url: URL;
        try {
          url = new URL(imageUrl);
        } catch {
          await interaction.reply({
            embeds: [errorEmbed("Invalid image URL.", "Use a public HTTPS image or GIF URL.")],
            ephemeral: true,
          });
          return;
        }
        if (url.protocol !== "https:") {
          await interaction.reply({
            embeds: [errorEmbed("Invalid image URL.", "Use a public HTTPS image or GIF URL.")],
            ephemeral: true,
          });
          return;
        }
      }
      await prisma.guildSettings.update({
        where: { guildId: guild.id },
        data: { welcomeImageUrl: imageUrl ? new URL(imageUrl).toString() : null },
      });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed(imageUrl ? "Welcome image updated" : "Welcome image cleared")],
        ephemeral: true,
      });
      return;
    }

    if (sub === "enable") {
      if (!settings.welcomeChannelId) {
        await interaction.reply({
          embeds: [errorEmbed("No welcome channel set.", "Use `/welcome channel` first.")],
          ephemeral: true,
        });
        return;
      }
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { welcomeEnabled: true } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Welcome messages enabled")], ephemeral: true });
      return;
    }

    if (sub === "disable") {
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { welcomeEnabled: false } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Welcome messages disabled")], ephemeral: true });
      return;
    }

    if (sub === "test") {
      const member = interaction.member as GuildMember | null;
      if (!member) return;
      await sendWelcome(guild, member);
      await interaction.reply({ embeds: [successEmbed("Test sent", "A test welcome message was sent.")], ephemeral: true });
    }
  },
};

export const goodbyeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("goodbye")
    .setDescription("Configure the goodbye message")
    .addSubcommand((sub) =>
      sub
        .setName("channel")
        .setDescription("Set the channel where goodbye messages are sent")
        .addChannelOption((option) =>
          option.setName("channel").setDescription("The goodbye channel").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription("Set the goodbye message template")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Use {user}, {username}, {userid}, {server}")
            .setRequired(true)
            .setMaxLength(2000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("image")
        .setDescription("Set or clear the farewell image or GIF")
        .addStringOption((option) =>
          option.setName("url").setDescription("Public HTTPS image or GIF URL (leave empty to clear)"),
        ),
    )
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable goodbye messages"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable goodbye messages"))
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
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { goodbyeChannelId: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Goodbye channel updated", `Goodbye messages go to ${channel}.`)], ephemeral: true });
      return;
    }

    if (sub === "message") {
      const message = interaction.options.getString("message", true);
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { goodbyeMessage: message } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Goodbye message updated", `Template: ${message}`)], ephemeral: true });
      return;
    }

    if (sub === "image") {
      const imageUrl = interaction.options.getString("url");
      if (imageUrl) {
        let url: URL;
        try {
          url = new URL(imageUrl);
        } catch {
          await interaction.reply({
            embeds: [errorEmbed("Invalid image URL.", "Use a public HTTPS image or GIF URL.")],
            ephemeral: true,
          });
          return;
        }
        if (url.protocol !== "https:") {
          await interaction.reply({
            embeds: [errorEmbed("Invalid image URL.", "Use a public HTTPS image or GIF URL.")],
            ephemeral: true,
          });
          return;
        }
      }
      await prisma.guildSettings.update({
        where: { guildId: guild.id },
        data: { goodbyeImageUrl: imageUrl ? new URL(imageUrl).toString() : null },
      });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed(imageUrl ? "Farewell image updated" : "Farewell image cleared")],
        ephemeral: true,
      });
      return;
    }

    if (sub === "enable") {
      if (!settings.goodbyeChannelId) {
        await interaction.reply({ embeds: [errorEmbed("No goodbye channel set.", "Use `/goodbye channel` first.")], ephemeral: true });
        return;
      }
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { goodbyeEnabled: true } });
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Goodbye messages enabled")], ephemeral: true });
      return;
    }

    await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { goodbyeEnabled: false } });
    invalidateConfigCache(guild.id);
    await interaction.reply({ embeds: [successEmbed("Goodbye messages disabled")], ephemeral: true });
  },
};

export const autoRoleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Automatically give a role to new members")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add an auto-role")
        .addRoleOption((option) => option.setName("role").setDescription("The role to give").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an auto-role")
        .addRoleOption((option) => option.setName("role").setDescription("The role to remove").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List the auto-roles"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const role = interaction.options.getRole("role", true);
      const current = await getAutoRoles(guild.id);
      if (!current.includes(role.id)) current.push(role.id);
      await setAutoRoles(guild.id, current);
      invalidateConfigCache(guild.id);

      await interaction.reply({
        embeds: [successEmbed("Auto-role added", `${role} will be given to new members.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "remove") {
      const role = interaction.options.getRole("role", true);
      const current = (await getAutoRoles(guild.id)).filter((id) => id !== role.id);
      await setAutoRoles(guild.id, current);
      invalidateConfigCache(guild.id);
      await interaction.reply({ embeds: [successEmbed("Auto-role removed", `${role} is no longer given to new members.`)], ephemeral: true });
      return;
    }

    const current = await getAutoRoles(guild.id);
    if (current.length === 0) {
      await interaction.reply({ embeds: [successEmbed("No auto-roles", "No auto-role is configured.")], ephemeral: true });
      return;
    }

    const lines = current.map((id) => `<@&${id}>`).join(", ");
    await interaction.reply({ embeds: [successEmbed("Auto-roles", lines)], ephemeral: true });
  },
};

export const reactionRoleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Give roles when a member reacts with an emoji")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a reaction role")
        .addChannelOption((option) =>
          option.setName("channel").setDescription("The channel with the message").setRequired(true),
        )
        .addStringOption((option) => option.setName("emoji").setDescription("The emoji to react with").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("The role to give").setRequired(true))
        .addStringOption((option) => option.setName("message-id").setDescription("The message id (optional)").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a reaction role")
        .addStringOption((option) => option.setName("emoji").setDescription("The emoji of the rule").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("The role of the rule").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List the reaction roles"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const channel = interaction.options.getChannel("channel", true);
      const emoji = interaction.options.getString("emoji", true);
      const role = interaction.options.getRole("role", true);
      const messageId = interaction.options.getString("message-id");

      await prisma.reactionRole.create({
        data: {
          guildId: guild.id,
          channelId: channel.id,
          emoji,
          roleId: role.id,
        },
      });

      if (messageId) {
        const resolved = await guild.channels.fetch(channel.id).catch(() => null);
        if (resolved?.isTextBased() && "messages" in resolved) {
          const message = await resolved.messages.fetch(messageId).catch(() => null);
          if (message) await message.react(emoji).catch(() => undefined);
        }
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "Reaction role added",
            `React with ${emoji} in ${channel} to get ${role}.${messageId ? ` Message: ${messageId}` : ""}`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "remove") {
      const emoji = interaction.options.getString("emoji", true);
      const role = interaction.options.getRole("role", true);
      const { count } = await prisma.reactionRole.deleteMany({ where: { guildId: guild.id, emoji, roleId: role.id } });
      await interaction.reply({
        embeds: [successEmbed("Reaction role removed", `Removed ${count} rule(s).`)],
        ephemeral: true,
      });
      return;
    }

    const rules = await prisma.reactionRole.findMany({ where: { guildId: guild.id } });
    if (rules.length === 0) {
      await interaction.reply({ embeds: [successEmbed("No reaction roles", "Nothing configured yet.")], ephemeral: true });
      return;
    }

    const lines = rules.map((rule) => `${rule.emoji} → <@&${rule.roleId}> in <#${rule.channelId}>`);
    await interaction.reply({
      embeds: [
        {
          title: `Reaction roles (${rules.length})`,
          color: 0x6366f1,
          description: lines.join("\n"),
          footer: { text: "GuardBot" },
        },
      ],
      ephemeral: true,
    });
  },
};

// ---------------------------------------------------------------------------
// Auto-role helpers
// ---------------------------------------------------------------------------

async function getAutoRoles(guildId: string): Promise<string[]> {
  const row = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (!row?.autoRoleIds) return [];
  try {
    const parsed = JSON.parse(row.autoRoleIds);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function setAutoRoles(guildId: string, roles: string[]): Promise<void> {
  await prisma.guildSettings.upsert({
    where: { guildId },
    update: { autoRoleIds: JSON.stringify(roles) },
    create: { guildId, autoRoleIds: JSON.stringify(roles) },
  });
}

export const welcomeCommands: Command[] = [welcomeCommand, goodbyeCommand, autoRoleCommand, reactionRoleCommand];
