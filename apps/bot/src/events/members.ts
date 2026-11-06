import type { Guild, GuildMember, PartialGuildMember } from "discord.js";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";
import { sendGoodbye, sendWelcome } from "../services/welcome";
import { sendMemberAutomation } from "../services/templateMessages";

function parseAutoRoles(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  const guild: Guild = member.guild;
  const settings = await getGuildSettings(guild.id);

  for (const roleId of parseAutoRoles(settings.autoRoleIds)) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;
    if (member.roles.cache.has(roleId)) continue;
    try {
      await member.roles.add(role, "Auto-role on join");
    } catch (error) {
      logger.warn("members", `Could not give the auto-role ${roleId}: ${(error as Error).message}`);
    }
  }

  try {
    await sendWelcome(guild, member);
  } catch (error) {
    logger.warn("members", `Could not send the welcome message: ${(error as Error).message}`);
  }

  await sendMemberAutomation(guild, member, "JOIN");
}

export async function onGuildMemberRemove(member: GuildMember): Promise<void> {
  try {
    await sendGoodbye(member.guild, member);
  } catch (error) {
    logger.warn("members", `Could not send the goodbye message: ${(error as Error).message}`);
  }

  await sendMemberAutomation(member.guild, member, "LEAVE");
}

export async function onGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<void> {
  const addedRole = newMember.roles.cache.some((role) => !oldMember.roles.cache.has(role.id));
  if (addedRole) {
    await sendMemberAutomation(newMember.guild, newMember, "ROLE_ADDED");
  }
}
