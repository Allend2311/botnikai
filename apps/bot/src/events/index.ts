import {
  Events,
  type AnyThreadChannel,
  type Client,
  type GuildMember,
  type Message,
} from "discord.js";
import { logger } from "../lib/logger";
import { registerGuildCommands } from "../lib/registerCommands";
import { ensureGuild } from "../lib/settings";
import { handleInteraction } from "./interactionCreate";
import { onGuildMemberAdd, onGuildMemberRemove } from "./members";
import { onMessageCreate, onMessageUpdate, onReactionAdd } from "./messages";
import { onPresenceUpdate } from "./presenceUpdate";
import { onReady } from "./ready";
import { announceChannelPost, onThreadCreate } from "./threads";

export function registerEvents(client: Client): void {
  client.once(Events.ClientReady, () => {
    void onReady(client);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(client, interaction);
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void onGuildMemberAdd(member as GuildMember).catch((error) =>
      logger.error("members", `Could not process a member joining: ${(error as Error).message}`, error),
    );
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void onGuildMemberRemove(member as GuildMember);
  });

  client.on(Events.PresenceUpdate, (oldPresence, newPresence) => {
    void onPresenceUpdate(client, oldPresence, newPresence);
  });

  client.on(Events.ThreadCreate, (thread) => {
    void onThreadCreate(thread as AnyThreadChannel);
  });

  client.on(Events.ChannelCreate, (channel) => {
    if (channel.isThread()) {
      void onThreadCreate(channel as AnyThreadChannel);
    }
  });

  client.on(Events.MessageCreate, (message) => {
    void onMessageCreate(message as Message);
    void announceChannelPost(message as Message);
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    void onMessageUpdate(oldMessage as Message, newMessage as Message);
  });

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void onReactionAdd(reaction, user);
  });

  client.on(Events.GuildCreate, (guild) => {
    void registerGuildCommands(guild.id).catch((error) =>
      logger.error("deploy", `Could not register commands in new guild ${guild.id}: ${(error as Error).message}`, error),
    );
    void ensureGuild(guild.id, guild.name, guild.ownerId, guild.iconURL(), guild.memberCount).catch((error) =>
      logger.warn("bot", `Could not sync the new guild: ${(error as Error).message}`),
    );
  });

  client.on(Events.GuildDelete, (guild) => {
    void prismaGuildRemove(guild.id);
  });

  client.on(Events.Error, (error) => {
    logger.error("client", error.message, error);
  });
}

async function prismaGuildRemove(guildId: string): Promise<void> {
  const { prisma } = await import("../lib/db");
  await prisma.case.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.warning.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.logEntry.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.commandStat.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.ticketTranscript.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.ticket.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.ticketPanel.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.reactionRole.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.automodConfig.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.guildSettings.deleteMany({ where: { guildId } }).catch(() => undefined);
  await prisma.guild.deleteMany({ where: { id: guildId } }).catch(() => undefined);
}
