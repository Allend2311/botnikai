import type { Client, Presence } from "discord.js";
import { prisma } from "../lib/db";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";
import { announceLive, announceLiveEnded, findLiveActivity } from "../services/live";

export async function onPresenceUpdate(
  client: Client,
  oldPresence: Presence | null,
  newPresence: Presence,
): Promise<void> {
  const guildId = newPresence.guild?.id ?? oldPresence?.guild?.id;
  if (!guildId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const settings = await getGuildSettings(guildId);
  if (!settings.liveEnabled) return;

  const member = guild.members.cache.get(newPresence.userId);
  if (!member || member.user.bot) return;

  const accounts = await prisma.liveStreamAccount.findMany({
    where: { guildId, platform: { in: ["Kick", "TikTok"] } },
    select: { platform: true, username: true },
  });
  if (accounts.length === 0) return;

  const previousActivity = findLiveActivity(oldPresence?.activities ?? [], accounts);
  const currentActivity = findLiveActivity(newPresence.activities ?? [], accounts);

  const wasLive = Boolean(previousActivity);
  const isLive = Boolean(currentActivity);

  try {
    if (isLive && !wasLive && currentActivity) {
      await announceLive(guild, member, currentActivity);
    } else if (!isLive && wasLive && previousActivity) {
      await announceLiveEnded(guild, member, previousActivity);
    }
  } catch (error) {
    logger.warn("live", `Could not handle the presence update: ${(error as Error).message}`);
  }
}
