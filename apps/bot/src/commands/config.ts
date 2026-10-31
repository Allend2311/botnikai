import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  AUTOMOD_ACTIONS,
  AUTOMOD_ACTION_LABELS,
  type AutomodAction,
} from "@guardbot/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { getAutomodConfig, getGuildSettings, invalidateConfigCache, parseJsonArray } from "../lib/settings";
import type { Command } from "../types";

const LOG_FIELDS = {
  mod: "modLogChannelId",
  ticket: "ticketLogChannelId",
  activity: "activityLogChannelId",
} as const;

type LogType = keyof typeof LOG_FIELDS;

const LOG_LABELS: Record<LogType, string> = {
  mod: "Moderation log",
  ticket: "Ticket log",
  activity: "Activity log",
};

const ACTION_FIELDS = {
  invites: "actionLink",
  links: "actionLink",
  spam: "actionSpam",
  words: "actionWord",
  caps: "actionCaps",
} as const;

type ActionTarget = keyof typeof ACTION_FIELDS;

const ACTION_TARGET_LABELS: Record<ActionTarget, string> = {
  invites: "Discord invites",
  links: "External links",
  spam: "Spam",
  words: "Banned words",
  caps: "Excessive caps",
};

export const logsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configure the server log channels")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set a log channel")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Which log to configure")
            .setRequired(true)
            .addChoices(
              { name: "Moderation", value: "mod" },
              { name: "Tickets", value: "ticket" },
              { name: "Activity", value: "activity" },
            ),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Where the log messages should be sent")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Stop sending a log")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Which log to clear")
            .setRequired(true)
            .addChoices(
              { name: "Moderation", value: "mod" },
              { name: "Tickets", value: "ticket" },
              { name: "Activity", value: "activity" },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Show the configured log channels"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();
    const settings = await getGuildSettings(guild.id);

    if (sub === "set") {
      const type = interaction.options.getString("type", true) as LogType;
      const channel = interaction.options.getChannel("channel", true);
      const field = LOG_FIELDS[type];
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { [field]: channel.id } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed(`${LOG_LABELS[type]} updated`, `Log messages will be sent to ${channel}.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "clear") {
      const type = interaction.options.getString("type", true) as LogType;
      const field = LOG_FIELDS[type];
      await prisma.guildSettings.update({ where: { guildId: guild.id }, data: { [field]: null } });
      invalidateConfigCache(guild.id);
      await interaction.reply({
        embeds: [successEmbed(`${LOG_LABELS[type]} cleared`, "That log is no longer mirrored to a channel.")],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Log channels")
      .setColor(0x6366f1)
      .addFields(
        { name: LOG_LABELS.mod, value: settings.modLogChannelId ? `<#${settings.modLogChannelId}>` : "Not set", inline: true },
        { name: LOG_LABELS.ticket, value: settings.ticketLogChannelId ? `<#${settings.ticketLogChannelId}>` : "Not set", inline: true },
        { name: LOG_LABELS.activity, value: settings.activityLogChannelId ? `<#${settings.activityLogChannelId}>` : "Not set", inline: true },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const automodCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Configure the automatic moderation")
    .addSubcommand((sub) => sub.setName("status").setDescription("Show the current auto-mod configuration"))
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable auto-mod"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable auto-mod"))
    .addSubcommand((sub) =>
      sub
        .setName("invites")
        .setDescription("Block Discord invite links")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enable the filter").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("links")
        .setDescription("Block external links")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enable the filter").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("allow-domain")
        .setDescription("Allow a domain when external links are blocked")
        .addStringOption((option) => option.setName("domain").setDescription("Example: youtube.com").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove-domain")
        .setDescription("Remove an allowed domain")
        .addStringOption((option) => option.setName("domain").setDescription("Example: youtube.com").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("domains").setDescription("List the allowed domains"))
    .addSubcommand((sub) =>
      sub
        .setName("word-add")
        .setDescription("Add a banned word")
        .addStringOption((option) => option.setName("word").setDescription("The word or phrase to block").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("word-remove")
        .setDescription("Remove a banned word")
        .addStringOption((option) => option.setName("word").setDescription("The word or phrase to remove").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("word-list").setDescription("List the banned words"))
    .addSubcommand((sub) =>
      sub
        .setName("caps")
        .setDescription("Filter messages with excessive capital letters")
        .addBooleanOption((option) => option.setName("enabled").setDescription("Enable the filter").setRequired(true))
        .addIntegerOption((option) =>
          option
            .setName("percent")
            .setDescription("Maximum percentage of capital letters (default 50)")
            .setMinValue(10)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("spam")
        .setDescription("Filter message spam")
        .addIntegerOption((option) =>
          option.setName("max-messages").setDescription("Messages allowed inside the window").setMinValue(2).setMaxValue(30).setRequired(true),
        )
        .addIntegerOption((option) =>
          option.setName("seconds").setDescription("Length of the window in seconds").setMinValue(1).setMaxValue(120).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("action")
        .setDescription("Choose what happens when a filter matches")
        .addStringOption((option) =>
          option
            .setName("filter")
            .setDescription("Which filter to configure")
            .setRequired(true)
            .addChoices(
              { name: "Discord invites", value: "invites" },
              { name: "External links", value: "links" },
              { name: "Spam", value: "spam" },
              { name: "Banned words", value: "words" },
              { name: "Excessive caps", value: "caps" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("What the bot should do")
            .setRequired(true)
            .addChoices(...AUTOMOD_ACTIONS.map((action) => ({ name: AUTOMOD_ACTION_LABELS[action], value: action }))),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ignore-channel")
        .setDescription("Ignore a channel in auto-mod")
        .addChannelOption((option) => option.setName("channel").setDescription("The channel to ignore").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unignore-channel")
        .setDescription("Stop ignoring a channel")
        .addChannelOption((option) => option.setName("channel").setDescription("The channel").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ignore-role")
        .setDescription("Ignore members with a role")
        .addRoleOption((option) => option.setName("role").setDescription("The role to ignore").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unignore-role")
        .setDescription("Stop ignoring a role")
        .addRoleOption((option) => option.setName("role").setDescription("The role").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("warn-limit")
        .setDescription("Warnings before an auto-mod timeout")
        .addIntegerOption((option) => option.setName("amount").setDescription("Warning count (1-20)").setMinValue(1).setMaxValue(20).setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeout")
        .setDescription("Length of auto-mod timeouts")
        .addIntegerOption((option) => option.setName("minutes").setDescription("Timeout duration in minutes (1-40320)").setMinValue(1).setMaxValue(40320).setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();
    const config = await getAutomodConfig(guild.id);

    const update = async (data: Prisma.AutomodConfigUpdateInput) => {
      await prisma.automodConfig.update({ where: { guildId: guild.id }, data });
      invalidateConfigCache(guild.id);
    };

    if (sub === "enable" || sub === "disable") {
      await update({ enabled: sub === "enable" });
      await interaction.reply({ embeds: [successEmbed(`Auto-mod ${sub === "enable" ? "enabled" : "disabled"}`)], ephemeral: true });
      return;
    }

    if (sub === "invites" || sub === "links") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await update(sub === "invites" ? { blockInvites: enabled } : { blockExternalLinks: enabled });
      await interaction.reply({
        embeds: [successEmbed(`${sub === "invites" ? "Invite" : "Link"} filter ${enabled ? "enabled" : "disabled"}`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "allow-domain" || sub === "remove-domain") {
      const input = interaction.options.getString("domain", true).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!input || input.includes(" ")) {
        await interaction.reply({ embeds: [errorEmbed("Invalid domain.", "Use a domain such as `youtube.com`.")], ephemeral: true });
        return;
      }

      const domains = parseJsonArray(config.allowedDomains);
      if (sub === "allow-domain") {
        if (!domains.includes(input)) domains.push(input);
      } else {
        const index = domains.indexOf(input);
        if (index !== -1) domains.splice(index, 1);
      }

      await update({ allowedDomains: JSON.stringify(domains) });
      await interaction.reply({
        embeds: [successEmbed(sub === "allow-domain" ? "Domain allowed" : "Domain removed", `\`${input}\``)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "domains") {
      const domains = parseJsonArray(config.allowedDomains);
      await interaction.reply({
        embeds: [
          domains.length === 0
            ? successEmbed("No allowed domains", "Every external link is blocked while the link filter is enabled.")
            : infoListEmbed("Allowed domains", domains.map((domain) => `\`${domain}\``)),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "word-add" || sub === "word-remove") {
      const word = interaction.options.getString("word", true).trim();
      if (!word) {
        await interaction.reply({ embeds: [errorEmbed("The word cannot be empty.")], ephemeral: true });
        return;
      }

      const words = parseJsonArray(config.bannedWords);
      if (sub === "word-add") {
        if (!words.some((entry) => entry.toLowerCase() === word.toLowerCase())) words.push(word);
      } else {
        const index = words.findIndex((entry) => entry.toLowerCase() === word.toLowerCase());
        if (index !== -1) words.splice(index, 1);
      }

      await update({ bannedWords: JSON.stringify(words) });
      await interaction.reply({
        embeds: [successEmbed(sub === "word-add" ? "Banned word added" : "Banned word removed", `\`${word}\``)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "word-list") {
      const words = parseJsonArray(config.bannedWords);
      await interaction.reply({
        embeds: [
          words.length === 0
            ? successEmbed("No banned words", "Add one with `/automod word-add`.")
            : infoListEmbed("Banned words", words.map((word) => `\`${word}\``)),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "caps") {
      const enabled = interaction.options.getBoolean("enabled", true);
      const percent = interaction.options.getInteger("percent");
      await update({ blockCaps: enabled, ...(percent != null ? { maxCapsPercent: percent } : {}) });
      await interaction.reply({
        embeds: [
          successEmbed(
            `Caps filter ${enabled ? "enabled" : "disabled"}`,
            percent != null ? `Maximum caps: ${percent}%` : undefined,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "spam") {
      const maxMessages = interaction.options.getInteger("max-messages", true);
      const seconds = interaction.options.getInteger("seconds", true);
      await update({ spamMaxMessages: maxMessages, spamWindowSeconds: seconds });
      await interaction.reply({
        embeds: [successEmbed("Spam filter updated", `More than ${maxMessages} messages in ${seconds} second(s) is spam.`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "action") {
      const filter = interaction.options.getString("filter", true) as ActionTarget;
      const action = interaction.options.getString("action", true) as AutomodAction;
      const field = ACTION_FIELDS[filter];
      const data: Prisma.AutomodConfigUpdateInput = {};
      data[field] = action;
      await update(data);
      await interaction.reply({
        embeds: [
          successEmbed(
            "Auto-mod action updated",
            `${ACTION_TARGET_LABELS[filter]}: **${AUTOMOD_ACTION_LABELS[action]}**`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "ignore-channel" || sub === "unignore-channel") {
      const channel = interaction.options.getChannel("channel", true);
      const ids = parseJsonArray(config.ignoreChannels);
      const index = ids.indexOf(channel.id);
      if (sub === "ignore-channel" && index === -1) ids.push(channel.id);
      if (sub === "unignore-channel" && index !== -1) ids.splice(index, 1);
      await update({ ignoreChannels: JSON.stringify(ids) });
      await interaction.reply({
        embeds: [successEmbed(sub === "ignore-channel" ? "Channel ignored" : "Channel no longer ignored", `${channel}`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "ignore-role" || sub === "unignore-role") {
      const role = interaction.options.getRole("role", true);
      const ids = parseJsonArray(config.ignoreRoles);
      const index = ids.indexOf(role.id);
      if (sub === "ignore-role" && index === -1) ids.push(role.id);
      if (sub === "unignore-role" && index !== -1) ids.splice(index, 1);
      await update({ ignoreRoles: JSON.stringify(ids) });
      await interaction.reply({
        embeds: [successEmbed(sub === "ignore-role" ? "Role ignored" : "Role no longer ignored", `${role}`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "warn-limit") {
      const amount = interaction.options.getInteger("amount", true);
      await update({ warnLimit: amount });
      await interaction.reply({
        embeds: [successEmbed("Warning limit updated", `Members are timed out after ${amount} auto-mod warning(s).`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "timeout") {
      const minutes = interaction.options.getInteger("minutes", true);
      await update({ timeoutMinutes: minutes });
      await interaction.reply({
        embeds: [successEmbed("Auto-mod timeout updated", `Timeouts last ${minutes} minute(s).`)],
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Auto-mod status")
      .setColor(config.enabled ? 0x22c55e : 0xef4444)
      .addFields(
        { name: "Enabled", value: config.enabled ? "Yes" : "No", inline: true },
        { name: "Invite filter", value: config.blockInvites ? "On" : "Off", inline: true },
        { name: "Link filter", value: config.blockExternalLinks ? "On" : "Off", inline: true },
        { name: "Caps filter", value: config.blockCaps ? `On (${config.maxCapsPercent}%)` : "Off", inline: true },
        { name: "Spam filter", value: `${config.spamMaxMessages} msg / ${config.spamWindowSeconds}s`, inline: true },
        { name: "Banned words", value: String(parseJsonArray(config.bannedWords).length), inline: true },
        { name: "Allowed domains", value: String(parseJsonArray(config.allowedDomains).length), inline: true },
        { name: "Ignored channels", value: String(parseJsonArray(config.ignoreChannels).length), inline: true },
        { name: "Ignored roles", value: String(parseJsonArray(config.ignoreRoles).length), inline: true },
        { name: "Warning limit", value: String(config.warnLimit), inline: true },
        { name: "Timeout", value: `${config.timeoutMinutes} min`, inline: true },
        {
          name: "Actions",
          value: [
            `Invites/links: **${AUTOMOD_ACTION_LABELS[config.actionLink as AutomodAction] ?? config.actionLink}**`,
            `Spam: **${AUTOMOD_ACTION_LABELS[config.actionSpam as AutomodAction] ?? config.actionSpam}**`,
            `Words: **${AUTOMOD_ACTION_LABELS[config.actionWord as AutomodAction] ?? config.actionWord}**`,
            `Caps: **${AUTOMOD_ACTION_LABELS[config.actionCaps as AutomodAction] ?? config.actionCaps}**`,
          ].join("\n"),
          inline: false,
        },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const settingsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Show an overview of the server configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const [settings, automod, panels, openTickets, roleRequests] = await Promise.all([
      getGuildSettings(guild.id),
      getAutomodConfig(guild.id),
      prisma.ticketPanel.count({ where: { guildId: guild.id } }),
      prisma.ticket.count({ where: { guildId: guild.id, status: "OPEN" } }),
      prisma.roleRequest.count({ where: { guildId: guild.id, status: { in: ["PENDING_VOUCH", "PENDING_REVIEW"] } } }),
    ]);

    const dashboard = `${process.env.APP_URL ?? "http://localhost:3000"}/dashboard/${guild.id}`;
    const autoRoles = parseJsonArray(settings.autoRoleIds);

    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} settings`)
      .setColor(0x6366f1)
      .setThumbnail(guild.iconURL({ size: 128 }))
      .setDescription(`Open the [web dashboard](${dashboard}) to edit everything with a full interface.`)
      .addFields(
        { name: "Welcome", value: settings.welcomeEnabled ? "Enabled" : "Disabled", inline: true },
        { name: "Goodbye", value: settings.goodbyeEnabled ? "Enabled" : "Disabled", inline: true },
        { name: "Auto-roles", value: String(autoRoles.length), inline: true },
        { name: "Auto-mod", value: automod.enabled ? "Enabled" : "Disabled", inline: true },
        { name: "Live alerts", value: settings.liveEnabled ? "Enabled" : "Disabled", inline: true },
        { name: "Post alerts", value: settings.postEnabled ? "Enabled" : "Disabled", inline: true },
        { name: "Ticket panels", value: String(panels), inline: true },
        { name: "Open tickets", value: String(openTickets), inline: true },
        { name: "Pending role requests", value: String(roleRequests), inline: true },
        { name: "Mod log", value: settings.modLogChannelId ? `<#${settings.modLogChannelId}>` : "Not set", inline: true },
        { name: "Ticket log", value: settings.ticketLogChannelId ? `<#${settings.ticketLogChannelId}>` : "Not set", inline: true },
        { name: "Activity log", value: settings.activityLogChannelId ? `<#${settings.activityLogChannelId}>` : "Not set", inline: true },
      )
      .setFooter({ text: "GuardBot" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

function infoListEmbed(title: string, entries: string[]): EmbedBuilder {
  const visible = entries.slice(0, 40);
  const description = visible.join(", ");
  return new EmbedBuilder()
    .setTitle(`${title} (${entries.length})`)
    .setColor(0x6366f1)
    .setDescription(description.length > 4000 ? `${description.slice(0, 3990)}…` : description)
    .setFooter({ text: "GuardBot" });
}

export const configCommands: Command[] = [logsCommand, automodCommand, settingsCommand];
