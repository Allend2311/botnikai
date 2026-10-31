import { PermissionFlagsBits, SlashCommandBuilder, type Role, type TextChannel } from "discord.js";
import { CASE_COLORS, CASE_LABELS } from "@guardbot/shared";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed, warnEmbed } from "../lib/embeds";
import { addWarning, formatMs, recordCase, tryDirectMessage } from "../services/moderation";
import type { Command } from "../types";

function durationOptions(maxMinutes = 60 * 24 * 28) {
  return new SlashCommandBuilder()
    .addIntegerOption((option) =>
      option
        .setName("duration")
        .setDescription("How long the timeout lasts (in minutes)")
        .setMinValue(1)
        .setMaxValue(maxMinutes)
        .setRequired(true),
    );
}

export const banCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption((option) => option.setName("user").setDescription("The member to ban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why are you banning them?"))
    .addIntegerOption((option) =>
      option.setName("days").setDescription("How many days of messages to delete (0-7)").setMinValue(0).setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute({ interaction, guild, client }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const days = interaction.options.getInteger("days") ?? 0;

    if (user.id === interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed("You cannot ban yourself.")], ephemeral: true });
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [errorEmbed("That member has the Administrator permission and cannot be banned.")],
        ephemeral: true,
      });
      return;
    }

    try {
      await guild.bans.create(user.id, { reason, deleteMessageSeconds: days * 86400 });
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed("Could not ban that member.", (error as Error).message)],
        ephemeral: true,
      });
      return;
    }

    await tryDirectMessage(
      client,
      user.id,
      warnEmbed(`You have been banned from ${guild.name}`, `Reason: ${reason}`),
    );

    const caseNumber = await recordCase({
      guild,
      type: "BAN",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason,
      meta: { deletedDays: days },
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Member banned",
          `<@${user.id}> has been banned. Case #${caseNumber} has been created.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const unbanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by id")
    .addStringOption((option) => option.setName("user").setDescription("The user id to unban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why are you unbanning them?"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const userId = interaction.options.getString("user", true).replace(/\D/g, "");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const ban = await guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.reply({ embeds: [errorEmbed("That user is not banned.")], ephemeral: true });
      return;
    }

    await guild.bans.remove(userId, reason);

    const caseNumber = await recordCase({
      guild,
      type: "UNBAN",
      targetId: userId,
      targetTag: ban.user.tag,
      moderatorId: interaction.user.id,
      reason,
    });

    await interaction.reply({
      embeds: [successEmbed("Member unbanned", `Case #${caseNumber} has been created.`)],
      ephemeral: true,
    });
  },
};

export const kickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption((option) => option.setName("user").setDescription("The member to kick").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why are you kicking them?"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.KickMembers],
  guildOnly: true,
  async execute({ interaction, guild, client }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed("That member is not in this server.")], ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        embeds: [errorEmbed("I cannot kick that member (they are above me in the role hierarchy).")],
        ephemeral: true,
      });
      return;
    }

    await member.kick(reason);
    await tryDirectMessage(client, user.id, warnEmbed(`You have been kicked from ${guild.name}`, `Reason: ${reason}`));

    const caseNumber = await recordCase({
      guild,
      type: "KICK",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason,
    });

    await interaction.reply({
      embeds: [successEmbed("Member kicked", `<@${user.id}> was kicked. Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const muteCommand: Command = {
  data: durationOptions()
    .setName("mute")
    .setDescription("Timeout a member for a given amount of time")
    .addUserOption((option) => option.setName("user").setDescription("The member to time out").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why are you timing them out?"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild, client }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("duration", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed("That member is not in this server.")], ephemeral: true });
      return;
    }

    if (!member.moderatable) {
      await interaction.reply({
        embeds: [errorEmbed("I cannot timeout that member (they are above me in the role hierarchy).")],
        ephemeral: true,
      });
      return;
    }

    const durationMs = minutes * 60_000;
    await member.timeout(durationMs, reason);
    await tryDirectMessage(
      client,
      user.id,
      warnEmbed(`You have been timed out in ${guild.name}`, `Reason: ${reason}\nDuration: ${minutes} minute(s).`),
    );

    const caseNumber = await recordCase({
      guild,
      type: "MUTE",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason,
      durationMs,
    });

    await interaction.reply({
      embeds: [
        successEmbed("Member timed out", `<@${user.id}> was timed out for ${minutes} minute(s). Case #${caseNumber}.`),
      ],
      ephemeral: true,
    });
  },
};

export const unmuteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove the timeout of a member")
    .addUserOption((option) => option.setName("user").setDescription("The member to unmute").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed("That member is not in this server.")], ephemeral: true });
      return;
    }

    await member.timeout(null);

    const caseNumber = await recordCase({
      guild,
      type: "UNMUTE",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason: "Timeout removed",
    });

    await interaction.reply({
      embeds: [successEmbed("Timeout removed", `<@${user.id}> can talk again. Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((option) => option.setName("user").setDescription("The member to warn").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why are you warning them?").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild, client }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    const total = await addWarning(guild.id, user.id, interaction.user.id, reason);
    await tryDirectMessage(client, user.id, warnEmbed(`You have been warned in ${guild.name}`, `Reason: ${reason}`));

    const caseNumber = await recordCase({
      guild,
      type: "WARN",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason,
      meta: { warningCount: total },
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Member warned",
          `<@${user.id}> now has ${total} warning(s). Case #${caseNumber}.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const warningsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("List the warnings of a member")
    .addUserOption((option) => option.setName("user").setDescription("The member to check").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const warnings = await prisma.warning.findMany({
      where: { guildId: guild.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    if (warnings.length === 0) {
      await interaction.reply({ embeds: [successEmbed("No warnings", `<@${user.id}> has no warnings.`)], ephemeral: true });
      return;
    }

    const lines = warnings.map(
      (warning, index) =>
        `**${index + 1}.** ${warning.reason} — <@${warning.moderatorId}> • <t:${Math.floor(warning.createdAt.getTime() / 1000)}:R>`,
    );

    await interaction.reply({
      embeds: [
        {
          title: `Warnings for ${user.username} (${warnings.length})`,
          color: 0xf59e0b,
          description: lines.join("\n"),
          footer: { text: "GuardBot" },
        },
      ],
      ephemeral: true,
    });
  },
};

export const removeWarnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("removewarn")
    .setDescription("Remove every warning from a member")
    .addUserOption((option) => option.setName("user").setDescription("The member to clear").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const { count } = await prisma.warning.deleteMany({ where: { guildId: guild.id, userId: user.id } });

    const caseNumber = await recordCase({
      guild,
      type: "UNWARN",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason: `${count} warning(s) removed`,
    });

    await interaction.reply({
      embeds: [successEmbed("Warnings cleared", `Removed ${count} warning(s). Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const purgeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete a number of recent messages")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("How many messages to delete (1-100)").setMinValue(1).setMaxValue(100).setRequired(true),
    )
    .addStringOption((option) => option.setName("reason").setDescription("Why are you deleting these messages?"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const amount = interaction.options.getInteger("amount", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [errorEmbed("This command cannot be used here.")], ephemeral: true });
      return;
    }

    const textChannel = channel as TextChannel;
    const deleted = await textChannel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) {
      await interaction.reply({
        embeds: [errorEmbed("Could not delete the messages.", "Messages older than 14 days cannot be deleted.")],
        ephemeral: true,
      });
      return;
    }

    const caseNumber = await recordCase({
      guild,
      type: "PURGE",
      targetId: textChannel.id,
      targetTag: `#${textChannel.name}`,
      moderatorId: interaction.user.id,
      reason,
      meta: { deleted: deleted.size },
    });

    await interaction.reply({
      embeds: [successEmbed("Messages purged", `Deleted ${deleted.size} message(s). Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const slowmodeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set the slowmode delay of this channel")
    .addIntegerOption((option) =>
      option.setName("seconds").setDescription("Delay in seconds (0-21600)").setMinValue(0).setMaxValue(21600).setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const seconds = interaction.options.getInteger("seconds", true);
    const channel = interaction.channel;

    if (!channel || !("setRateLimitPerUser" in channel)) {
      await interaction.reply({ embeds: [errorEmbed("Slowmode cannot be set in this channel.")], ephemeral: true });
      return;
    }

    const textChannel = channel as TextChannel;
    await textChannel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

    const caseNumber = await recordCase({
      guild,
      type: "SLOWMODE",
      targetId: textChannel.id,
      targetTag: `#${textChannel.name}`,
      moderatorId: interaction.user.id,
      reason: `Slowmode set to ${seconds} second(s)`,
      durationMs: seconds * 1000,
    });

    await interaction.reply({
      embeds: [successEmbed("Slowmode updated", `Slowmode is now ${seconds} second(s). Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const lockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock the current channel")
    .addStringOption((option) => option.setName("reason").setDescription("Why is the channel locked?"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const channel = interaction.channel;

    if (!channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({ embeds: [errorEmbed("This channel cannot be locked.")], ephemeral: true });
      return;
    }

    const textChannel = channel as TextChannel;
    const everyone = guild.roles.everyone;
    await textChannel.permissionOverwrites.edit(
      everyone,
      { SendMessages: false },
      { reason: `Locked by ${interaction.user.tag}: ${reason}` },
    );

    const caseNumber = await recordCase({
      guild,
      type: "LOCK",
      targetId: textChannel.id,
      targetTag: `#${textChannel.name}`,
      moderatorId: interaction.user.id,
      reason,
    });

    await interaction.reply({
      embeds: [successEmbed("Channel locked", `#${textChannel.name} is now locked. Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock the current channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const channel = interaction.channel;

    if (!channel || !("permissionOverwrites" in channel)) {
      await interaction.reply({ embeds: [errorEmbed("This channel cannot be unlocked.")], ephemeral: true });
      return;
    }

    const textChannel = channel as TextChannel;
    const everyone = guild.roles.everyone;
    await textChannel.permissionOverwrites.edit(
      everyone,
      { SendMessages: null },
      { reason: `Unlocked by ${interaction.user.tag}` },
    );

    const caseNumber = await recordCase({
      guild,
      type: "UNLOCK",
      targetId: textChannel.id,
      targetTag: `#${textChannel.name}`,
      moderatorId: interaction.user.id,
      reason: "Channel unlocked",
    });

    await interaction.reply({
      embeds: [successEmbed("Channel unlocked", `#${textChannel.name} is open again. Case #${caseNumber}.`)],
      ephemeral: true,
    });
  },
};

export const modlogsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("modlogs")
    .setDescription("Show the most recent moderation cases")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("How many cases to show (1-25)").setMinValue(1).setMaxValue(25),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const amount = interaction.options.getInteger("amount") ?? 10;

    const cases = await prisma.case.findMany({
      where: { guildId: guild.id },
      orderBy: { createdAt: "desc" },
      take: amount,
    });

    if (cases.length === 0) {
      await interaction.reply({ embeds: [successEmbed("No cases yet", "This server has no moderation history yet.")], ephemeral: true });
      return;
    }

    const lines = cases.map(
      (entry) =>
        `#${entry.caseNumber} **${CASE_LABELS[entry.type as keyof typeof CASE_LABELS] ?? entry.type}** — ${
          entry.targetTag ? `<@${entry.targetId}>` : "server"
        } • <t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`,
    );

    await interaction.reply({
      embeds: [
        {
          title: `Recent cases (${cases.length})`,
          color: 0x6366f1,
          description: lines.join("\n"),
          footer: { text: "GuardBot" },
        },
      ],
      ephemeral: true,
    });
  },
};

export const caseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("Show a moderation case")
    .addIntegerOption((option) =>
      option.setName("number").setDescription("The case number").setMinValue(1).setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const caseNumber = interaction.options.getInteger("number", true);

    const entry = await prisma.case.findUnique({
      where: { guildId_caseNumber: { guildId: guild.id, caseNumber } },
    });
    if (!entry) {
      await interaction.reply({ embeds: [errorEmbed("Case not found", `No case #${caseNumber} exists in this server.`)], ephemeral: true });
      return;
    }

    const type = entry.type as keyof typeof CASE_LABELS;
    const embed = {
      title: `Case #${entry.caseNumber} • ${CASE_LABELS[type] ?? entry.type}`,
      color: CASE_COLORS[type] ?? 0x6366f1,
      fields: [
        { name: "Target", value: entry.targetTag ? `${entry.targetTag} (\`${entry.targetId}\`)` : `<@${entry.targetId}>`, inline: false },
        { name: "Moderator", value: `<@${entry.moderatorId}>`, inline: true },
        { name: "Created", value: `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:F>`, inline: true },
        { name: "Reason", value: entry.reason, inline: false },
        ...(entry.durationMs ? [{ name: "Duration", value: formatMs(entry.durationMs), inline: true }] : []),
        ...(entry.meta ? [{ name: "Details", value: `\`\`\`json\n${entry.meta.slice(0, 900)}\n\`\`\``, inline: false }] : []),
      ],
      footer: { text: "GuardBot" },
      timestamp: new Date().toISOString(),
    };

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const deleteCaseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("delcase")
    .setDescription("Delete a moderation case from the history")
    .addIntegerOption((option) =>
      option.setName("number").setDescription("The case number").setMinValue(1).setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const caseNumber = interaction.options.getInteger("number", true);
    const { count } = await prisma.case.deleteMany({ where: { guildId: guild.id, caseNumber } });

    if (count === 0) {
      await interaction.reply({ embeds: [errorEmbed("Case not found", `No case #${caseNumber} exists in this server.`)], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [successEmbed("Case deleted", `Case #${caseNumber} was removed from the history.`)], ephemeral: true });
  },
};

export const softbanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("Ban and immediately unban a member to delete their messages")
    .addUserOption((option) => option.setName("user").setDescription("The member to softban").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("Why are you softbanning them?"))
    .addIntegerOption((option) =>
      option.setName("days").setDescription("How many days of messages to delete (0-7)").setMinValue(0).setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute({ interaction, guild, client }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";
    const days = interaction.options.getInteger("days") ?? 1;

    if (user.id === interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed("You cannot softban yourself.")], ephemeral: true });
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member?.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [errorEmbed("That member has the Administrator permission and cannot be softbanned.")],
        ephemeral: true,
      });
      return;
    }

    try {
      await guild.bans.create(user.id, { reason: `Softban: ${reason}`, deleteMessageSeconds: days * 86400 });
      await guild.bans.remove(user.id, `Softban: ${reason}`);
    } catch (error) {
      await interaction.reply({
        embeds: [errorEmbed("Could not softban that member.", (error as Error).message)],
        ephemeral: true,
      });
      return;
    }

    await tryDirectMessage(
      client,
      user.id,
      warnEmbed(`You have been softbanned from ${guild.name}`, `Reason: ${reason}\nYou may rejoin with a new invite.`),
    );

    const caseNumber = await recordCase({
      guild,
      type: "BAN",
      targetId: user.id,
      targetTag: user.tag,
      moderatorId: interaction.user.id,
      reason,
      meta: { softban: true, deletedDays: days },
    });

    await interaction.reply({
      embeds: [
        successEmbed(
          "Member softbanned",
          `<@${user.id}> was removed and their recent messages were deleted. Case #${caseNumber}.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const roleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Give a role to a member")
        .addUserOption((option) => option.setName("user").setDescription("The member").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("The role to give").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role from a member")
        .addUserOption((option) => option.setName("user").setDescription("The member").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("The role to remove").setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true) as Role;

    if (role.id === guild.id) {
      await interaction.reply({ embeds: [errorEmbed("The @everyone role cannot be assigned.")], ephemeral: true });
      return;
    }
    if (role.managed) {
      await interaction.reply({ embeds: [errorEmbed("That role is managed by an integration and cannot be assigned.")], ephemeral: true });
      return;
    }

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed("That member is not in this server.")], ephemeral: true });
      return;
    }

    const me = guild.members.me;
    if (!me || role.position >= me.roles.highest.position) {
      await interaction.reply({
        embeds: [errorEmbed("I cannot manage that role.", "Move my role above it in the server settings.")],
        ephemeral: true,
      });
      return;
    }

    try {
      if (sub === "add") {
        await member.roles.add(role, `Added by ${interaction.user.tag}`);
      } else {
        await member.roles.remove(role, `Removed by ${interaction.user.tag}`);
      }
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed("Could not update the roles.", (error as Error).message)], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          sub === "add" ? "Role added" : "Role removed",
          `${role} was ${sub === "add" ? "given to" : "removed from"} ${member}.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const nicknameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Change or reset the nickname of a member")
    .addUserOption((option) => option.setName("user").setDescription("The member").setRequired(true))
    .addStringOption((option) =>
      option.setName("name").setDescription("The new nickname (leave empty to reset)").setMaxLength(32),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageNicknames],
  botPermissions: [PermissionFlagsBits.ManageNicknames],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const user = interaction.options.getUser("user", true);
    const name = interaction.options.getString("name")?.trim() || null;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed("That member is not in this server.")], ephemeral: true });
      return;
    }

    if (member.id === guild.ownerId) {
      await interaction.reply({ embeds: [errorEmbed("The server owner's nickname cannot be changed.")], ephemeral: true });
      return;
    }

    try {
      await member.setNickname(name, `Changed by ${interaction.user.tag}`);
    } catch (error) {
      await interaction.reply({ embeds: [errorEmbed("Could not change the nickname.", (error as Error).message)], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          name ? "Nickname updated" : "Nickname reset",
          name ? `${member} is now called **${name}**.` : `${member} uses their original username again.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const nukeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Recreate this channel and delete every message in it")
    .addStringOption((option) =>
      option.setName("confirm").setDescription('Type "confirm" to permanently delete the channel history').setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),
  botPermissions: [PermissionFlagsBits.ManageChannels],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const confirmation = interaction.options.getString("confirm", true).trim().toLowerCase();
    if (confirmation !== "confirm") {
      await interaction.reply({
        embeds: [errorEmbed("Nuke cancelled.", 'You must type `confirm` in the confirm option.')],
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || channel.isDMBased() || !("clone" in channel)) {
      await interaction.reply({ embeds: [errorEmbed("This channel cannot be recreated.")], ephemeral: true });
      return;
    }

    const textChannel = channel as TextChannel;
    const position = textChannel.position;
    const parentId = textChannel.parentId;

    await interaction.deferReply({ ephemeral: true });

    const cloned = await textChannel.clone({ reason: `Channel nuked by ${interaction.user.tag}` });
    await cloned.setPosition(position).catch(() => undefined);
    await textChannel.delete(`Channel nuked by ${interaction.user.tag}`);

    await cloned.send({
      embeds: [
        successEmbed(
          "Channel cleared",
          `This channel was recreated by ${interaction.user}. ${parentId ? `Previous category: <#${parentId}>.` : ""}`,
        ),
      ],
    });

    await interaction
      .editReply({ embeds: [successEmbed("Channel recreated", `Continue the conversation in ${cloned}.`)] })
      .catch(() => undefined);
  },
};

export const moderationCommands: Command[] = [
  banCommand,
  unbanCommand,
  kickCommand,
  muteCommand,
  unmuteCommand,
  warnCommand,
  warningsCommand,
  removeWarnCommand,
  purgeCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand,
  modlogsCommand,
  caseCommand,
  deleteCaseCommand,
  softbanCommand,
  roleCommand,
  nicknameCommand,
  nukeCommand,
];
