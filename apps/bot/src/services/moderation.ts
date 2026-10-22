import { EmbedBuilder, type Client, type Guild } from "discord.js";
import { CASE_COLORS, CASE_LABELS, type CaseType } from "@guardbot/shared";
import { prisma } from "../lib/db";
import { baseEmbed, field } from "../lib/embeds";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";

export interface CaseInput {
  guild: Guild;
  type: CaseType;
  targetId?: string | null;
  targetTag?: string | null;
  moderatorId: string;
  reason: string;
  durationMs?: number | null;
  meta?: Record<string, unknown> | null;
}

/** Sends a DM to a member, ignoring closed DMs. Returns true when delivered. */
export async function tryDirectMessage(client: Client, userId: string, embed: EmbedBuilder): Promise<boolean> {
  try {
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a moderation case in the database and mirrors it to the mod-log channel.
 */
export async function recordCase(input: CaseInput): Promise<number> {
  const { guild } = input;
  const settings = await getGuildSettings(guild.id);

  const caseNumber = (await prisma.case.count({ where: { guildId: guild.id } })) + 1;

  await prisma.case.create({
    data: {
      caseNumber,
      guildId: guild.id,
      type: input.type,
      targetId: input.targetId ?? guild.id,
      targetTag: input.targetTag ?? null,
      moderatorId: input.moderatorId,
      reason: input.reason || "No reason provided",
      durationMs: input.durationMs ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });

  await prisma.logEntry.create({
    data: {
      guildId: guild.id,
      type: input.type,
      message: `${CASE_LABELS[input.type]} - ${input.targetTag ?? "server"} - ${input.reason || "No reason provided"}`,
    },
  });

  const embed = buildCaseEmbed(caseNumber, input);

  if (settings.modLogChannelId) {
    const channel = guild.channels.cache.get(settings.modLogChannelId);
    if (channel && channel.isTextBased()) {
      try {
        await channel.send({ embeds: [embed] });
      } catch (error) {
        logger.warn("moderation", `Could not write to the mod-log channel: ${(error as Error).message}`);
      }
    }
  }

  return caseNumber;
}

export function buildCaseEmbed(caseNumber: number, input: CaseInput): EmbedBuilder {
  const embed = baseEmbed(`Case #${caseNumber} • ${CASE_LABELS[input.type]}`)
    .setColor(CASE_COLORS[input.type] ?? 0x5865f2)
    .addFields(
      field("Target", input.targetTag ? `${input.targetTag} (\`${input.targetId}\`)` : "—", false),
      field("Moderator", `<@${input.moderatorId}>`, false),
      field("Reason", input.reason || "No reason provided", false),
    );

  if (input.durationMs) {
    embed.addFields(field("Duration", formatMs(input.durationMs)));
  }

  return embed;
}

export function formatMs(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/** Adds a warning and returns the total amount of active warnings for that user. */
export async function addWarning(guildId: string, userId: string, moderatorId: string, reason: string): Promise<number> {
  await prisma.warning.create({ data: { guildId, userId, reason, moderatorId } });
  return prisma.warning.count({ where: { guildId, userId } });
}
