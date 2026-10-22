import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadCommands } from "./commands";
import { config } from "./config";
import { registerEvents } from "./events";
import { prisma } from "./lib/db";
import { logger } from "./lib/logger";

async function main(): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.GuildMember,
      Partials.Reaction,
      Partials.User,
    ],
  });

  client.commands = loadCommands();
  registerEvents(client);

  await prisma.$connect();
  logger.info("bot", "Database connected");

  await client.login(config.DISCORD_TOKEN);
}

main().catch((error) => {
  logger.error("bot", `Fatal error: ${(error as Error).message}`, error);
  process.exit(1);
});
