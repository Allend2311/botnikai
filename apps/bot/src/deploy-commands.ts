import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { config } from "./config";
import { logger } from "./lib/logger";

async function main(): Promise<void> {
  const body = commands.map((command) => command.data.toJSON());

  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  if (config.DEV_GUILD_ID) {
    logger.info("deploy", `Registering ${body.length} commands in the guild ${config.DEV_GUILD_ID}...`);
    await rest.put(Routes.applicationGuildCommands(config.DISCORD_APPLICATION_ID, config.DEV_GUILD_ID), { body });
    logger.info("deploy", "Guild commands registered.");
    return;
  }

  logger.info("deploy", `Registering ${body.length} global commands...`);
  await rest.put(Routes.applicationCommands(config.DISCORD_APPLICATION_ID), { body });
  logger.info("deploy", "Global commands registered (they can take up to an hour to appear).");
}

main().catch((error) => {
  logger.error("deploy", `Failed to register the commands: ${(error as Error).message}`);
  process.exit(1);
});
