import {
  BROADCAST_FOOTER,
  pickBroadcastChannel,
  type BroadcastChannelInfo,
} from "@guardbot/shared";
import {
  createChannelMessage,
  DiscordApiError,
  getBotGuild,
  getBotGuilds,
  getGuildChannels,
  guildIconUrl,
} from "./discord";

/** A server plus the channel an update would be posted in. */
export interface BroadcastTarget {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  channelId: string | null;
  channelName: string | null;
  /** Why the server cannot receive an update (empty when it can). */
  reason: string;
}

export interface BroadcastPayload {
  title: string;
  message: string;
  imageUrl: string | null;
}

export interface BroadcastSendResult {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
}

export class BroadcastError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "BroadcastError";
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index] as T);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function pickForGuild(
  guildId: string,
): Promise<{ guildName: string; channel: BroadcastChannelInfo | null }> {
  const [guild, channels] = await Promise.all([getBotGuild(guildId), getGuildChannels(guildId)]);
  if (!guild) {
    throw new BroadcastError("The bot is not installed in that server.", 404);
  }

  const channel = pickBroadcastChannel({
    systemChannelId: guild.system_channel_id ?? null,
    channels: channels.map((entry) => ({ id: entry.id, name: entry.name, type: entry.type })),
  });

  return { guildName: guild.name, channel };
}

/** Loads every server the bot is in and resolves its update channel. */
export async function loadBroadcastTargets(): Promise<BroadcastTarget[]> {
  const guilds = await getBotGuilds();

  const targets = await mapWithConcurrency(guilds, 6, async (guild) => {
    const base = {
      guildId: guild.id,
      guildName: guild.name,
      guildIcon: guildIconUrl(guild.id, guild.icon),
    };

    try {
      const { channel } = await pickForGuild(guild.id);
      if (!channel) {
        return {
          ...base,
          channelId: null,
          channelName: null,
          reason: "No announcement or update channel",
        };
      }

      return {
        ...base,
        channelId: channel.id,
        channelName: channel.name,
        reason: "",
      };
    } catch (error) {
      console.error(`[broadcast] could not inspect guild ${guild.id}:`, error);
      return {
        ...base,
        channelId: null,
        channelName: null,
        reason: "Could not read this server's channels",
      };
    }
  });

  return targets.sort((a, b) => a.guildName.localeCompare(b.guildName));
}

function messagePayload(payload: BroadcastPayload): Record<string, unknown> {
  const embed: Record<string, unknown> = {
    title: payload.title,
    description: payload.message,
    color: 0x6366f1,
    footer: { text: BROADCAST_FOOTER },
    timestamp: new Date().toISOString(),
  };
  if (payload.imageUrl) embed.image = { url: payload.imageUrl };

  // Never ping @everyone/@here from a global broadcast.
  return { embeds: [embed], allowed_mentions: { parse: [] } };
}

/** Sends the update to one server. Throws a `BroadcastError` on known failures. */
export async function sendBroadcastToGuild(
  guildId: string,
  payload: BroadcastPayload,
): Promise<BroadcastSendResult> {
  const { guildName, channel } = await pickForGuild(guildId);

  if (!channel) {
    throw new BroadcastError(
      "No announcement or update channel found. Set a system messages channel or create #announcements.",
      409,
    );
  }

  try {
    await createChannelMessage(channel.id, messagePayload(payload));
  } catch (error) {
    if (error instanceof DiscordApiError && (error.status === 403 || error.status === 404)) {
      throw new BroadcastError(
        `The bot cannot post in #${channel.name}. Check its permissions in that channel.`,
        409,
      );
    }
    throw error;
  }

  return {
    guildId,
    guildName,
    channelId: channel.id,
    channelName: channel.name,
  };
}
