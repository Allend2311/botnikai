import { ActivityType, type Client } from "discord.js";
import { logger } from "../lib/logger";
import { ensureGuild } from "../lib/settings";

export async function onReady(client: Client): Promise<void> {
  logger.info("bot", `Logged in as ${client.user?.tag ?? "unknown"}`);

  client.user?.setActivity("with /help", { type: ActivityType.Watching });
  client.user?.setStatus("online");

  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureGuild(guild.id, guild.name, guild.ownerId, guild.iconURL(), guild.memberCount);
    } catch (error) {
      logger.warn("bot", `Could not sync guild ${guild.id}: ${(error as Error).message}`);
    }
  }

  logger.info("bot", `Ready - ${client.guilds.cache.size} server(s), ${client.commands.size} command(s) loaded`);
}
