import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  PermissionResolvable,
  SlashCommandBuilder,
} from "discord.js";
import type { PrismaClient } from "@prisma/client";

/**
 * The command builders return different classes depending on the options that
 * were used (plain, options only, subcommands...). This structural type keeps
 * every variant assignable.
 */
export interface CommandData {
  readonly name: string;
  readonly description: string;
  toJSON(): unknown;
}

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  client: Client;
  guild: Guild | null;
  prisma: PrismaClient;
}

export interface Command {
  data: CommandData;
  /** Permissions the *user* needs to run the command. */
  userPermissions?: PermissionResolvable[];
  /** Permissions the *bot* needs in the guild to run the command. */
  botPermissions?: PermissionResolvable[];
  /** Only usable inside a server. */
  guildOnly?: boolean;
  /** Deferred reply is used for slow commands. */
  defer?: boolean;
  execute(context: CommandContext): Promise<void>;
}

export type { SlashCommandBuilder };

declare module "discord.js" {
  interface Client {
    commands: Map<string, Command>;
  }
}
