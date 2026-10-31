import { ChannelType, type AnyThreadChannel, type Message } from "discord.js";
import { truncate } from "@guardbot/shared";
import { logger } from "../lib/logger";
import { getGuildSettings } from "../lib/settings";
import { announcePost } from "../services/live";

/** Thread create events can fire twice (channelCreate + threadCreate). */
const handled = new Map<string, number>();

function alreadyHandled(id: string): boolean {
  const now = Date.now();
  for (const [key, timestamp] of handled) {
    if (now - timestamp > 60_000) handled.delete(key);
  }
  if (handled.has(id)) return true;
  handled.set(id, now);
  return false;
}

export async function onThreadCreate(thread: AnyThreadChannel): Promise<void> {
  const guild = thread.guild;
  if (!guild) return;

  const parent = thread.parent;
  if (!parent || parent.type !== ChannelType.GuildForum) return;

  if (alreadyHandled(thread.id)) return;

  const settings = await getGuildSettings(guild.id);
  if (!settings.postEnabled) return;
  if (settings.postForumChannelId !== parent.id) return;

  // Give the author a moment to finish the first message.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  let authorId = thread.ownerId ?? "";
  let authorTag = "Unknown";
  let content: string | undefined;
  let avatarUrl: string | undefined;

  try {
    const messages = await thread.messages.fetch({ limit: 20 });
    const first = messages.filter((message) => !message.author.bot).first();
    if (first) {
      authorId = first.author.id;
      authorTag = first.author.tag;
      content = settings.postIncludeContent ? truncate(first.content, 800) : undefined;
      avatarUrl = first.author.displayAvatarURL({ size: 256 });
    }
  } catch (error) {
    logger.warn("posts", `Could not read the first post: ${(error as Error).message}`);
  }

  if (!authorId) {
    const owner = thread.ownerId ? await guild.members.fetch(thread.ownerId).catch(() => null) : null;
    authorId = owner?.id ?? guild.ownerId;
    authorTag = owner?.user.tag ?? "Unknown";
    avatarUrl = owner?.user.displayAvatarURL({ size: 256 });
  }

  try {
    await announcePost(guild, {
      title: thread.name,
      authorId,
      authorTag,
      content,
      url: `https://discord.com/channels/${guild.id}/${thread.id}`,
      avatarUrl,
      roleId: settings.postRoleId,
      pingAuthor: settings.postPingAuthor,
      pingEveryone: settings.postPingEveryone,
      pingHere: settings.postPingHere,
    });
  } catch (error) {
    logger.warn("posts", `Could not announce the forum post: ${(error as Error).message}`);
  }
}

export async function announceChannelPost(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild || message.author.bot) return;

  const settings = await getGuildSettings(guild.id);
  if (!settings.postEnabled) return;
  if (settings.postWatchChannelId !== message.channelId) return;
  if (message.channel.isThread()) return;

  const channelName = "name" in message.channel ? message.channel.name : "channel";

  await announcePost(guild, {
    title: `New post in #${channelName}`,
    authorId: message.author.id,
    authorTag: message.author.tag,
    content: settings.postIncludeContent ? truncate(message.content, 800) : undefined,
    url: message.url,
    avatarUrl: message.author.displayAvatarURL({ size: 256 }),
    roleId: settings.postRoleId,
    pingAuthor: settings.postPingAuthor,
    pingEveryone: settings.postPingEveryone,
    pingHere: settings.postPingHere,
  });
}
