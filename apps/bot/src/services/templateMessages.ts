import {
  DiscordAPIError,
  EmbedBuilder,
  type Client,
  type Guild,
  type GuildMember,
  type Message,
  type User,
} from "discord.js";
import { applyTemplate } from "@guardbot/shared";
import { prisma } from "../lib/db";
import { logger } from "../lib/logger";

type TemplateMessage = {
  templateName: string;
  content: string;
  embedTitle: string | null;
  embedDescription: string | null;
};

type AutomationTrigger = "JOIN" | "LEAVE" | "ROLE_ADDED";

const STICKY_MESSAGE_LOCKS = new Map<string, Promise<void>>();
let scheduledMessageTimer: NodeJS.Timeout | undefined;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function messagePayload(
  template: TemplateMessage,
  guild: Guild,
  user?: User,
) {
  const values = {
    ...(user
      ? {
          user: `<@${user.id}>`,
          username: user.username,
          userid: user.id,
        }
      : {}),
    server: guild.name,
    membercount: guild.memberCount,
  };
  const content = applyTemplate(template.content, values);
  const embedTitle = template.embedTitle ? applyTemplate(template.embedTitle, values) : null;
  const embedDescription = template.embedDescription
    ? applyTemplate(template.embedDescription, values)
    : null;
  const embeds = embedTitle || embedDescription
    ? [
        (() => {
          const embed = new EmbedBuilder()
            .setColor(0x6366f1)
            .setFooter({ text: template.templateName });
          if (embedTitle) embed.setTitle(embedTitle);
          if (embedDescription) embed.setDescription(embedDescription);
          return embed;
        })(),
      ]
    : undefined;

  return {
    ...(content ? { content } : {}),
    ...(embeds ? { embeds } : {}),
    allowedMentions: { parse: [] },
  };
}

export async function sendMemberAutomation(
  guild: Guild,
  member: GuildMember,
  trigger: AutomationTrigger,
): Promise<void> {
  const automations = await prisma.messageAutomation.findMany({
    where: { guildId: guild.id, trigger, enabled: true },
  });

  for (const automation of automations) {
    try {
      const payload = messagePayload(automation, guild, member.user);
      if (!automation.channelId) {
        await member.user.send(payload);
        continue;
      }

      const channel = await guild.channels.fetch(automation.channelId);
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Automation channel ${automation.channelId} is unavailable or not text-based.`);
      }
      await channel.send(payload);
    } catch (error) {
      logger.warn(
        "templates",
        `Could not run ${trigger} automation ${automation.id} in guild ${guild.id}: ${errorMessage(error)}`,
      );
    }
  }
}

export async function updateStickyMessage(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild || message.author.bot) return;

  const sticky = await prisma.stickyMessage.findUnique({
    where: { channelId: message.channelId },
  });
  if (!sticky || !sticky.autoUpdate || sticky.guildId !== guild.id) return;

  const previous = STICKY_MESSAGE_LOCKS.get(message.channelId) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(async () => {
    const latest = await prisma.stickyMessage.findUnique({
      where: { channelId: message.channelId },
    });
    if (!latest || !latest.autoUpdate || latest.guildId !== guild.id) return;

    const channel = await guild.channels.fetch(message.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Sticky channel ${message.channelId} is unavailable or not text-based.`);
    }

    const posted = await channel.send(messagePayload(latest, guild, message.author));
    const previousMessageId = latest.messageId;
    await prisma.stickyMessage.update({
      where: { id: latest.id },
      data: { messageId: posted.id },
    });

    if (previousMessageId && previousMessageId !== posted.id) {
      try {
        const previousMessage = await channel.messages.fetch(previousMessageId);
        await previousMessage.delete();
      } catch (error) {
        if (!(error instanceof DiscordAPIError) || error.code !== 10008) {
          logger.warn(
            "templates",
            `Could not remove the previous sticky message ${previousMessageId}: ${errorMessage(error)}`,
          );
        }
      }
    }
  });
  STICKY_MESSAGE_LOCKS.set(message.channelId, current);

  try {
    await current;
  } catch (error) {
    logger.warn(
      "templates",
      `Could not update the sticky message in channel ${message.channelId}: ${errorMessage(error)}`,
    );
  } finally {
    if (STICKY_MESSAGE_LOCKS.get(message.channelId) === current) {
      STICKY_MESSAGE_LOCKS.delete(message.channelId);
    }
  }
}

export function startScheduledMessageWorker(client: Client): void {
  if (scheduledMessageTimer) return;

  const processDueMessages = async () => {
    if (!client.isReady()) return;

    const dueMessages = await prisma.scheduledMessage.findMany({
      where: { status: "PENDING", scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 25,
    });

    for (const scheduled of dueMessages) {
      const claimed = await prisma.scheduledMessage.updateMany({
        where: { id: scheduled.id, status: "PENDING" },
        data: { status: "SENDING", error: null },
      });
      if (claimed.count !== 1) continue;

      try {
        const guild = client.guilds.cache.get(scheduled.guildId) ??
          await client.guilds.fetch(scheduled.guildId);
        const channel = await guild.channels.fetch(scheduled.channelId);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Scheduled channel ${scheduled.channelId} is unavailable or not text-based.`);
        }
        await channel.send(messagePayload(scheduled, guild));
        await prisma.scheduledMessage.update({
          where: { id: scheduled.id },
          data: { status: "SENT", sentAt: new Date(), error: null },
        });
      } catch (error) {
        const message = errorMessage(error);
        await prisma.scheduledMessage.update({
          where: { id: scheduled.id },
          data: { status: "FAILED", error: message.slice(0, 2000) },
        });
        logger.error(
          "templates",
          `Could not send scheduled message ${scheduled.id}: ${message}`,
          error,
        );
      }
    }
  };

  const run = () => {
    void processDueMessages().catch((error) =>
      logger.error("templates", `Scheduled message worker failed: ${errorMessage(error)}`, error),
    );
  };
  void prisma.scheduledMessage.updateMany({
    where: { status: "SENDING" },
    data: { status: "PENDING" },
  }).then(run).catch((error) =>
    logger.error("templates", `Could not recover scheduled messages: ${errorMessage(error)}`, error),
  );
  scheduledMessageTimer = setInterval(run, 15_000);
  scheduledMessageTimer.unref();
}
