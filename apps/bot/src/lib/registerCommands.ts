import { PermissionFlagsBits, REST, Routes } from "discord.js";
import { commands } from "../commands";
import { config } from "../config";
import { logger } from "./logger";

function getCommandDefinitions() {
  return commands.map((command) => {
    const data = command.data.toJSON();
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error(`/${command.data.name} did not produce a valid command definition.`);
    }

    return {
      ...data,
      // Owner commands are hidden from regular members and must work in DMs.
      default_member_permissions:
        command.ownerOnly || command.adminOnly === false
          ? null
          : PermissionFlagsBits.Administrator.toString(),
      dm_permission: command.ownerOnly === true,
    };
  });
}

export async function registerCommands(): Promise<void> {
  const body = getCommandDefinitions();
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  logger.info("deploy", `Registering ${body.length} global commands...`);
  await rest.put(Routes.applicationCommands(config.DISCORD_APPLICATION_ID), { body });
  logger.info("deploy", "Global commands registered.");
}

export async function registerGuildCommands(guildId: string): Promise<void> {
  const body = getCommandDefinitions();
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

  logger.info("deploy", `Registering ${body.length} commands in guild ${guildId}...`);
  await rest.put(Routes.applicationGuildCommands(config.DISCORD_APPLICATION_ID, guildId), { body });
  logger.info("deploy", `Commands registered in guild ${guildId}.`);
}
