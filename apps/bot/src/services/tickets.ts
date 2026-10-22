import {
  ButtonStyle,
  ChannelType,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ActionRowData,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentData,
  type TextChannel,
} from "discord.js";
import { prisma } from "../lib/db";
import { baseEmbed, errorEmbed, successEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";

const TICKET_NAME_PREFIX = "ticket-";
const TICKET_NAME_CLOSED = "closed-";

export function createTicketButton(ticketId: string, label = "Create ticket"): ActionRowData<MessageActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        customId: `ticket:create:${ticketId}`,
        label,
        emoji: { name: "🎫" },
      },
    ],
  };
}

export function closeTicketButton(ticketId: string): ActionRowData<MessageActionRowComponentData> {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        customId: `ticket:close:${ticketId}`,
        label: "Close ticket",
        emoji: { name: "🔒" },
      },
    ],
  };
}

export async function createTicket(guild: Guild, member: GuildMember, panelId: string): Promise<{ channelId: string; ticketId: string }> {
  const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
  if (!panel) throw new Error("Ticket panel not found");

  const openTickets = await prisma.ticket.count({
    where: { guildId: guild.id, userId: member.id, status: "OPEN" },
  });

  if (openTickets >= (panel.maxOpenPerUser || 1)) {
    throw new Error("You already have an open ticket. Please close it before opening a new one.");
  }

  const settings = await getGuildSettings(guild.id);
  const category = panel.categoryId ? guild.channels.cache.get(panel.categoryId) : undefined;

  const channelName = `${TICKET_NAME_PREFIX}${member.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`.slice(0, 90);

  const channel = (await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category && category.type === ChannelType.GuildCategory ? category.id : undefined,
    topic: `Support ticket opened by ${member.user.tag}`,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
      },
      {
        id: guild.client.user!.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
      },
      ...(panel.supportRoleId
        ? [
            {
              id: panel.supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ]
        : []),
    ],
  })) as TextChannel;

  const ticket = await prisma.ticket.create({
    data: {
      guildId: guild.id,
      panelId: panel.id,
      channelId: channel.id,
      userId: member.id,
      subject: panel.title,
      status: "OPEN",
    },
  });

  const embed = baseEmbed(`Ticket opened by ${member.user.username}`)
    .setColor(0x6366f1)
    .setDescription(
      `Welcome ${member.user}! A member of the support team will be with you shortly.\nUse the button below once you are done.`,
    )
    .addFields({ name: "Ticket ID", value: ticket.id, inline: true });

  await channel.send({ embeds: [embed], components: [closeTicketButton(ticket.id)] });

  if (settings.ticketLogChannelId) {
    const logChannel = guild.channels.cache.get(settings.ticketLogChannelId);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({
        embeds: [
          baseEmbed("New ticket")
            .setColor(0x6366f1)
            .setDescription(`<@${member.id}> opened a ticket in <#${channel.id}>.`)
            .addFields({ name: "Panel", value: panel.title, inline: true }),
        ],
      });
    }
  }

  return { channelId: channel.id, ticketId: ticket.id };
}

export async function buildTranscript(channel: TextChannel): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines: string[] = [];

  for (const message of messages.values()) {
    const stamp = message.createdAt.toISOString().replace("T", " ").slice(0, 19);
    const content = message.content || "(no text content)";
    lines.push(`[${stamp}] ${message.author.tag}: ${content}`);
  }

  return lines.reverse().join("\n") || "This ticket had no messages.";
}

export async function closeTicket(guild: Guild, ticketId: string, closedBy: string): Promise<string> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket not found.");
  if (ticket.status === "CLOSED") throw new Error("This ticket is already closed.");

  const channel = guild.channels.cache.get(ticket.channelId);
  let transcript = "This ticket had no messages.";

  if (channel && channel.isTextBased()) {
    try {
      transcript = await buildTranscript(channel as TextChannel);
    } catch (error) {
      logger.warn("tickets", `Could not read transcript: ${(error as Error).message}`);
    }
  }

  await prisma.ticketTranscript.create({
    data: { ticketId: ticket.id, guildId: guild.id, content: transcript },
  });

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "CLOSED", closedAt: new Date(), closedBy },
  });

  if (channel && channel.isTextBased()) {
    try {
      await (channel as TextChannel).send({
        embeds: [
          successEmbed("Ticket closed", `Closed by <@${closedBy}>. This channel will be archived shortly.`),
        ],
      });
      await (channel as TextChannel).setName(`${TICKET_NAME_CLOSED}${channel.name.replace(/^(closed-|ticket-)/, "")}`.slice(0, 90));
      const archivable = channel as unknown as { setArchived?: (value: boolean) => Promise<unknown> };
      if (typeof archivable.setArchived === "function") {
        await archivable.setArchived(true).catch(() => undefined);
      }
    } catch (error) {
      logger.warn("tickets", `Could not archive channel: ${(error as Error).message}`);
    }
  }

  const settings = await getGuildSettings(guild.id);
  if (settings.ticketLogChannelId) {
    const logChannel = guild.channels.cache.get(settings.ticketLogChannelId);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({
        embeds: [
          baseEmbed("Ticket closed")
            .setColor(0x22c55e)
            .setDescription(`<@${closedBy}> closed <#${ticket.channelId}>.`)
            .addFields(
              { name: "Opened by", value: `<@${ticket.userId}>`, inline: true },
              { name: "Duration", value: formatDuration(Date.now() - ticket.createdAt.getTime()), inline: true },
            ),
        ],
      });
    }
  }

  return ticket.id;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export async function ensurePanelMessage(guild: Guild, panelId: string): Promise<void> {
  const panel = await prisma.ticketPanel.findUnique({ where: { id: panelId } });
  if (!panel || !panel.messageId) return;

  const channel = guild.channels.cache.get(panel.channelId);
  if (!channel || !channel.isTextBased()) return;

  try {
    const message = await (channel as TextChannel).messages.fetch(panel.messageId);
    const embed = new EmbedBuilder()
      .setTitle(panel.title)
      .setColor(0x6366f1)
      .setDescription(panel.description ?? "Click the button below to open a support ticket.");
    await message.edit({ embeds: [embed], components: [createTicketButton(panel.id)] });
  } catch (error) {
    logger.warn("tickets", `Could not refresh panel message: ${(error as Error).message}`);
  }
}

export { errorEmbed };
