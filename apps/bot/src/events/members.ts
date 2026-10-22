import type { Guild, GuildMember } from "discord.js";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";
import { sendGoodbye, sendWelcome } from "../services/welcome";

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
}

export async function onGuildMemberRemove(member: GuildMember): Promise<void> {
  try {
    await sendGoodbye(member.guild, member);
  } catch (error) {
    logger.warn("members", `Could not send the goodbye message: ${(error as Error).message}`);
  }
}
