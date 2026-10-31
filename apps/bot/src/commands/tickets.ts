import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, type GuildMember, type TextChannel } from "discord.js";
import { prisma } from "../lib/db";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { closeTicket, createTicketButton } from "../services/tickets";
import type { Command } from "../types";

export const ticketPanelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Manage the support ticket panel")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a ticket panel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Where the panel should be posted")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option.setName("title").setDescription("Panel title").setRequired(true).setMaxLength(100),
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("The category where ticket channels are created")
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addStringOption((option) =>
          option.setName("description").setDescription("Panel description").setMaxLength(1000),
        )
        .addRoleOption((option) => option.setName("support-role").setDescription("The role that can see tickets"))
        .addIntegerOption((option) =>
          option
            .setName("max-per-user")
            .setDescription("How many tickets a member may open (default 1)")
            .setMinValue(1)
            .setMaxValue(10),
        ),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List the ticket panels"))
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a ticket panel")
        .addStringOption((option) => option.setName("panel-id").setDescription("The panel id").setRequired(true)),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === "create") {
      const channel = interaction.options.getChannel("channel", true);
      const category = interaction.options.getChannel("category", false);
      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description");
      const supportRole = interaction.options.getRole("support-role", false);
      const maxPerUser = interaction.options.getInteger("max-per-user") ?? 1;

      const panel = await prisma.ticketPanel.create({
        data: {
          guildId: guild.id,
          channelId: channel.id,
          messageId: "",
          title,
          description: description ?? null,
          categoryId: category?.id ?? null,
          supportRoleId: supportRole?.id ?? null,
          maxOpenPerUser: maxPerUser,
        },
      });

      const embed = {
        title,
        color: 0x6366f1,
        description: description ?? "Click the button below to open a support ticket.",
        footer: { text: "GuardBot" },
        timestamp: new Date().toISOString(),
      };

      const message = await (channel as TextChannel).send({
        embeds: [embed],
        components: [createTicketButton(panel.id)],
      });

      await prisma.ticketPanel.update({ where: { id: panel.id }, data: { messageId: message.id } });

      await interaction.reply({
        embeds: [successEmbed("Ticket panel created", `Panel created in ${channel}. Panel id: \`${panel.id}\``)],
        ephemeral: true,
      });
      return;
    }

    if (sub === "list") {
      const panels = await prisma.ticketPanel.findMany({ where: { guildId: guild.id } });
      if (panels.length === 0) {
        await interaction.reply({ embeds: [successEmbed("No panels", "No ticket panel has been created yet.")], ephemeral: true });
        return;
      }

      const lines = panels.map(
        (panel) => `\`${panel.id}\` — **${panel.title}** in <#${panel.channelId}> (${panel.maxOpenPerUser} ticket(s) per member)`,
      );

      await interaction.reply({
        embeds: [
          {
            title: `Ticket panels (${panels.length})`,
            color: 0x6366f1,
            description: lines.join("\n"),
            footer: { text: "GuardBot" },
          },
        ],
        ephemeral: true,
      });
      return;
    }

    const panelId = interaction.options.getString("panel-id", true);
    const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
    if (!panel || panel.guildId !== guild.id) {
      await interaction.reply({ embeds: [errorEmbed("Panel not found.")], ephemeral: true });
      return;
    }

    await prisma.ticketPanel.delete({ where: { id: panelId } });
    await interaction.reply({ embeds: [successEmbed("Panel removed", `Panel \`${panelId}\` was removed.`)], ephemeral: true });
  },
};

export const ticketCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the support tickets")
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close the current ticket")
        .addStringOption((option) => option.setName("reason").setDescription("Why are you closing it?")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a member to the current ticket")
        .addUserOption((option) => option.setName("user").setDescription("The member to add").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a member from the current ticket")
        .addUserOption((option) => option.setName("user").setDescription("The member to remove").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("Rename the current ticket channel")
        .addStringOption((option) => option.setName("name").setDescription("The new channel name").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("info").setDescription("Show the details of the current ticket"))
    .addSubcommand((sub) => sub.setName("list").setDescription("List the open tickets"))
    .setDMPermission(false),
  adminOnly: false,
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const sub = interaction.options.getSubcommand();
    const member = interaction.member as GuildMember | null;
    if (!member) return;

    const isManager =
      member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      member.permissions.has(PermissionFlagsBits.Administrator);

    if (sub === "list") {
      let canList = isManager;
      if (!canList) {
        const panels = await prisma.ticketPanel.findMany({
          where: { guildId: guild.id },
          select: { supportRoleId: true },
        });
        canList = panels.some((panel) => panel.supportRoleId && member.roles.cache.has(panel.supportRoleId));
      }

      if (!canList) {
        await interaction.reply({
          embeds: [errorEmbed("Only the support team can list tickets.")],
          ephemeral: true,
        });
        return;
      }

      const tickets = await prisma.ticket.findMany({
        where: { guildId: guild.id, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      if (tickets.length === 0) {
        await interaction.reply({ embeds: [successEmbed("No open tickets", "Every ticket in this server is closed.")], ephemeral: true });
        return;
      }

      const lines = tickets.map(
        (entry) =>
          `<#${entry.channelId}> — opened by <@${entry.userId}> <t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`,
      );

      await interaction.reply({
        embeds: [
          {
            title: `Open tickets (${tickets.length})`,
            color: 0x6366f1,
            description: lines.join("\n"),
            footer: { text: "GuardBot" },
          },
        ],
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel;

    if (!channel || channel.isThread()) {
      await interaction.reply({ embeds: [errorEmbed("Run this command inside a ticket channel.")], ephemeral: true });
      return;
    }

    const ticket = await prisma.ticket.findFirst({ where: { guildId: guild.id, channelId: channel.id } });
    if (!ticket) {
      await interaction.reply({ embeds: [errorEmbed("This channel is not a ticket.")], ephemeral: true });
      return;
    }

    const panel = ticket.panelId
      ? await prisma.ticketPanel.findUnique({ where: { id: ticket.panelId } })
      : null;
    const isSupport =
      isManager ||
      Boolean(panel?.supportRoleId && member.roles.cache.has(panel.supportRoleId));
    const isOwner = ticket.userId === interaction.user.id;

    if (sub === "info") {
      const transcripts = await prisma.ticketTranscript.count({ where: { ticketId: ticket.id } });
      await interaction.reply({
        embeds: [
          {
            title: `Ticket ${ticket.id.slice(0, 8)}`,
            color: ticket.status === "OPEN" ? 0x22c55e : 0x64748b,
            fields: [
              { name: "Subject", value: ticket.subject, inline: false },
              { name: "Status", value: ticket.status === "OPEN" ? "Open" : "Closed", inline: true },
              { name: "Opened by", value: `<@${ticket.userId}>`, inline: true },
              { name: "Opened", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`, inline: true },
              { name: "Transcript entries", value: String(transcripts), inline: true },
              ...(ticket.closedAt
                ? [{ name: "Closed", value: `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>`, inline: true }]
                : []),
              ...(ticket.closedBy
                ? [{ name: "Closed by", value: `<@${ticket.closedBy}>`, inline: true }]
                : []),
            ],
            footer: { text: "GuardBot" },
          },
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === "close") {
      if (!isOwner && !isSupport) {
        await interaction.reply({
          embeds: [errorEmbed("Only the ticket owner or the support team can close this ticket.")],
          ephemeral: true,
        });
        return;
      }

      try {
        await closeTicket(guild, ticket.id, interaction.user.id);
        await interaction.reply({ embeds: [successEmbed("Ticket closed", "The transcript has been saved.")], ephemeral: true });
      } catch (error) {
        await interaction.reply({ embeds: [errorEmbed("Could not close the ticket.", (error as Error).message)], ephemeral: true });
      }
      return;
    }

    if (!isSupport) {
      await interaction.reply({
        embeds: [errorEmbed("Only the support team can manage this ticket.")],
        ephemeral: true,
      });
      return;
    }

    if (sub === "add" || sub === "remove") {
      const user = interaction.options.getUser("user", true);
      const target = await guild.members.fetch(user.id).catch(() => null);
      if (!target) {
        await interaction.reply({ embeds: [errorEmbed("That member is not in this server.")], ephemeral: true });
        return;
      }

      const textChannel = channel as TextChannel;
      const permission = sub === "add" ? { ViewChannel: true, SendMessages: true } : { ViewChannel: false };
      await textChannel.permissionOverwrites.edit(target.id, permission, {
        reason: `${sub === "add" ? "Added" : "Removed"} by ${interaction.user.tag}`,
      });

      await interaction.reply({
        embeds: [successEmbed(sub === "add" ? "Member added" : "Member removed", `<@${user.id}>`)],
        ephemeral: true,
      });
      return;
    }

    const name = interaction.options.getString("name", true).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90);
    await (channel as TextChannel).setName(name, `Renamed by ${interaction.user.tag}`);
    await interaction.reply({ embeds: [successEmbed("Ticket renamed", `Channel renamed to \`${name}\`.`)], ephemeral: true });
  },
};

export const ticketCommands: Command[] = [ticketPanelCommand, ticketCommand];
