import {
  PermissionFlagsBits,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import { logger } from "../lib/logger";
import { prisma } from "../lib/db";
import { checkMessage } from "../services/automod";
import { addWarning, recordCase } from "../services/moderation";
import { getCachedConfig } from "../lib/settings";

async function handleViolation(message: Message, violation: NonNullable<Awaited<ReturnType<typeof checkMessage>>>): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  const { automod } = await getCachedConfig(guild.id);
  const member = message.member;

  // The message is always removed for the filtered categories.
  try {
    await message.delete();
  } catch {
    /* the message may have been deleted already */
  }

  let escalation = "";
  let memberId = message.author.id;

  if (violation.action === "WARN") {
    const count = await addWarning(guild.id, message.author.id, guild.client.user!.id, violation.reason);
    escalation = `Warning #${count}`;

    if (count >= automod.warnLimit) {
      try {
        await member?.timeout(automod.timeoutMinutes * 60_000, `Auto-mod escalation: ${violation.reason}`);
        escalation += ` - timed out for ${automod.timeoutMinutes} minute(s)`;
      } catch {
        /* ignore */
      }
    }
  } else if (violation.action === "TIMEOUT") {
    try {
      await member?.timeout(automod.timeoutMinutes * 60_000, `Auto-mod: ${violation.reason}`);
      escalation = `Timed out for ${automod.timeoutMinutes} minute(s)`;
    } catch {
      escalation = "Timeout failed (role hierarchy)";
    }
  } else if (violation.action === "KICK") {
    try {
      await member?.kick(`Auto-mod: ${violation.reason}`);
      escalation = "Kicked";
    } catch {
      escalation = "Kick failed (role hierarchy)";
    }
  }

  await recordCase({
    guild,
    type: "AUTOMOD",
    targetId: memberId,
    targetTag: message.author.tag,
    moderatorId: guild.client.user!.id,
    reason: violation.reason,
    meta: { kind: violation.kind, action: violation.action, matched: violation.matched, escalation },
  });

  try {
    await message.author.send({
      content: `Your message in **${guild.name}** was removed by the auto-mod.\nReason: ${violation.reason}`,
    });
  } catch {
    /* DMs are closed */
  }
}

export async function onMessageCreate(message: Message): Promise<void> {
  try {
    const violation = await checkMessage(message);
    if (violation) {
      await handleViolation(message, violation);
    }
  } catch (error) {
    logger.error("automod", `Could not check the message: ${(error as Error).message}`);
  }
}

export async function onMessageUpdate(
  _oldMessage: Message,
  newMessage: Message,
): Promise<void> {
  if (!newMessage.guild || newMessage.author.bot) return;
  if (!newMessage.content) return;

  try {
    const violation = await checkMessage(newMessage);
    if (violation) {
      await handleViolation(newMessage, violation);
    }
  } catch (error) {
    logger.error("automod", `Could not check the edited message: ${(error as Error).message}`);
  }
}

export async function onReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  const message = reaction.message as Message | undefined;
  if (!message || !message.guild) return;

  const emojiKey = reaction.emoji.id ?? reaction.emoji.name;
  if (!emojiKey) return;

  const rule = await prisma.reactionRole.findFirst({
    where: {
      guildId: message.guild.id,
      channelId: message.channel.id,
      emoji: emojiKey,
    },
  });

  if (!rule) {
    const byName = await prisma.reactionRole.findFirst({
      where: { guildId: message.guild.id, channelId: message.channel.id, emoji: reaction.emoji.name ?? "" },
    });
    if (!byName) return;
    await applyRole(message, byName.roleId, user.id);
    return;
  }

  await applyRole(message, rule.roleId, user.id);
}

async function applyRole(message: Message, roleId: string, userId: string): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  if (!member.permissions.has(PermissionFlagsBits.ManageRoles) && member.id !== guild.ownerId) {
    // Still allowed, but the role must be below the member.
  }

  const role = guild.roles.cache.get(roleId);
  if (!role) return;
  if (role.position >= (member.roles.highest?.position ?? 0) && member.id !== guild.ownerId) {
    try {
      await member.send(`I could not give you the ${role.name} role because it is above your highest role.`);
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    await member.roles.add(role, "Reaction role");
  } catch (error) {
    logger.warn("roles", `Could not give the reaction role: ${(error as Error).message}`);
  }
}
