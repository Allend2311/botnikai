import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type NewsChannel,
  type TextChannel,
} from "discord.js";
import {
  BROADCAST_FOOTER,
  BROADCAST_MESSAGE_MAX,
  BROADCAST_TITLE_MAX,
  pickBroadcastChannel,
  toHttpsUrl,
} from "@guardbot/shared";
import { errorEmbed, successEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
import type { Command } from "../types";

type SendableChannel = TextChannel | NewsChannel;

interface BroadcastTarget {
  guild: Guild;
  channel: SendableChannel;
}

interface SkippedTarget {
  guild: Guild;
  reason: string;
}

interface BroadcastPayload {
  title: string;
  message: string;
  image: string | null;
}

const DEFAULT_TITLE = "Bot update";
const SEND_DELAY_MS = 400;
const PROGRESS_INTERVAL_MS = 2500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mentionable(guildName: string): string {
  return guildName.replaceAll("`", "'");
}

/** Channels the bot is actually allowed to post embeds in. */
function sendableChannel(guild: Guild, channelId: string): SendableChannel | null {
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return null;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    return null;
  }

  const me = guild.members.me;
  const permissions = me ? channel.permissionsFor(me) : null;
  if (
    !permissions?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])
  ) {
    return null;
  }

  return channel as SendableChannel;
}

/** Applies the shared channel-selection rules to a live guild. */
function resolveGuildTarget(guild: Guild): {
  target: BroadcastTarget | null;
  reason: string;
} {
  const picked = pickBroadcastChannel({
    systemChannelId: guild.systemChannelId,
    channels: [...guild.channels.cache.values()].map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
    })),
  });

  if (!picked) {
    return { target: null, reason: "No update/announcement channel" };
  }

  const channel = sendableChannel(guild, picked.id);
  if (!channel) {
    return { target: null, reason: `Missing permissions in #${picked.name}` };
  }

  return { target: { guild, channel }, reason: "" };
}

function resolveTargets(client: Client): {
  ready: BroadcastTarget[];
  skipped: SkippedTarget[];
} {
  const ready: BroadcastTarget[] = [];
  const skipped: SkippedTarget[] = [];

  for (const guild of client.guilds.cache.values()) {
    const { target, reason } = resolveGuildTarget(guild);
    if (target) {
      ready.push(target);
    } else {
      skipped.push({ guild, reason: reason || "Unavailable" });
    }
  }

  return { ready, skipped };
}

function readPayload(
  interaction: ChatInputCommandInteraction,
): { ok: true; payload: BroadcastPayload } | { ok: false; error: string } {
  const message = (interaction.options.getString("message", true) ?? "").trim();
  if (!message) {
    return { ok: false, error: "The message cannot be empty." };
  }
  if (message.length > BROADCAST_MESSAGE_MAX) {
    return { ok: false, error: `The message must be shorter than ${BROADCAST_MESSAGE_MAX} characters.` };
  }

  const title = (interaction.options.getString("title") ?? DEFAULT_TITLE).trim().slice(0, BROADCAST_TITLE_MAX);
  if (!title) {
    return { ok: false, error: "The title cannot be empty." };
  }

  const rawImage = interaction.options.getString("image-url");
  const image = rawImage ? toHttpsUrl(rawImage) : null;
  if (rawImage && !image) {
    return { ok: false, error: "The image URL must be a public HTTPS URL." };
  }

  return { ok: true, payload: { title, message, image } };
}

function buildEmbed(payload: BroadcastPayload): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(payload.title)
    .setDescription(payload.message)
    .setFooter({ text: BROADCAST_FOOTER })
    .setTimestamp();

  if (payload.image) embed.setImage(payload.image);
  return embed;
}

function progressEmbed(done: number, total: number, payload: BroadcastPayload): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("Broadcasting update…")
    .setDescription(`**${done} / ${total}** servers processed\n\n${payload.title}`)
    .setFooter({ text: BROADCAST_FOOTER });
}

function truncateList(lines: string[], max = 1000): string {
  const text = lines.join("\n");
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export const broadcastCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("broadcast")
    .setDescription("Send an update to every server the bot is in (bot owner only)")
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send the update to every server")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("The update text")
            .setRequired(true)
            .setMaxLength(BROADCAST_MESSAGE_MAX),
        )
        .addStringOption((option) =>
          option
            .setName("confirm")
            .setDescription('Type "send" to confirm the global broadcast')
            .setRequired(true)
            .setMaxLength(10),
        )
        .addStringOption((option) =>
          option.setName("title").setDescription(`Update title (default: ${DEFAULT_TITLE})`).setMaxLength(BROADCAST_TITLE_MAX),
        )
        .addStringOption((option) =>
          option.setName("image-url").setDescription("Optional public HTTPS image URL"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("preview")
        .setDescription("Post the update only in this server")
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("The update text")
            .setRequired(true)
            .setMaxLength(BROADCAST_MESSAGE_MAX),
        )
        .addStringOption((option) =>
          option.setName("title").setDescription(`Update title (default: ${DEFAULT_TITLE})`).setMaxLength(BROADCAST_TITLE_MAX),
        )
        .addStringOption((option) =>
          option.setName("image-url").setDescription("Optional public HTTPS image URL"),
        ),
    ),
  ownerOnly: true,
  defer: true,
  async execute({ interaction, client, guild }) {
    const sub = interaction.options.getSubcommand();
    const parsed = readPayload(interaction);
    if (!parsed.ok) {
      await interaction.editReply({ embeds: [errorEmbed("Invalid update", parsed.error)] });
      return;
    }

    const payload = parsed.payload;
    const embed = buildEmbed(payload);

    if (sub === "preview") {
      if (!guild) {
        await interaction.editReply({
          embeds: [errorEmbed("Run the preview inside a server.", "Use `/broadcast send` from a direct message to reach every server.")],
        });
        return;
      }

      const { target, reason } = resolveGuildTarget(guild);
      if (!target) {
        await interaction.editReply({
          embeds: [
            errorEmbed(
              "No update channel in this server",
              `${reason}. Set a system messages channel or create an #announcements channel.`,
            ),
          ],
        });
        return;
      }

      try {
        await target.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      } catch (error) {
        await interaction.editReply({
          embeds: [errorEmbed("Could not post the preview", (error as Error).message)],
        });
        return;
      }

      await interaction.editReply({
        embeds: [successEmbed("Preview sent", `Posted in ${target.channel} of **${mentionable(guild.name)}**.`)],
      });
      return;
    }

    const confirmation = (interaction.options.getString("confirm") ?? "").trim().toLowerCase();
    if (confirmation !== "send") {
      await interaction.editReply({
        embeds: [errorEmbed("Broadcast cancelled", 'You must type `send` in the confirm option.')],
      });
      return;
    }

    const { ready, skipped } = resolveTargets(client);
    if (ready.length === 0) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            "No servers to broadcast to",
            "The bot is not in any server with a usable update channel.",
          ),
        ],
      });
      return;
    }

    const failed: SkippedTarget[] = [];
    let sent = 0;
    let lastProgress = Date.now();

    for (const [index, target] of ready.entries()) {
      try {
        await target.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        sent += 1;
      } catch (error) {
        failed.push({
          guild: target.guild,
          reason: (error as Error).message.split("\n")[0]?.slice(0, 160) ?? "Unknown error",
        });
      }

      if (index < ready.length - 1) {
        await delay(SEND_DELAY_MS);
        if (Date.now() - lastProgress >= PROGRESS_INTERVAL_MS) {
          lastProgress = Date.now();
          await interaction
            .editReply({ embeds: [progressEmbed(index + 1, ready.length, payload)] })
            .catch(() => undefined);
        }
      }
    }

    logger.info(
      "broadcast",
      `Sent "${payload.title}" to ${sent}/${ready.length} servers (${skipped.length} skipped, ${failed.length} failed).`,
    );

    const summary = new EmbedBuilder()
      .setColor(failed.length > 0 ? 0xf59e0b : 0x22c55e)
      .setTitle("Broadcast complete")
      .setDescription(`**${payload.title}**`)
      .addFields(
        { name: "Delivered", value: String(sent), inline: true },
        { name: "Skipped", value: String(skipped.length), inline: true },
        { name: "Failed", value: String(failed.length), inline: true },
      )
      .setFooter({ text: BROADCAST_FOOTER })
      .setTimestamp();

    if (skipped.length > 0) {
      summary.addFields({
        name: "Skipped servers",
        value: truncateList(skipped.map((entry) => `• ${mentionable(entry.guild.name)} — ${entry.reason}`)),
        inline: false,
      });
    }

    if (failed.length > 0) {
      summary.addFields({
        name: "Failed servers",
        value: truncateList(failed.map((entry) => `• ${mentionable(entry.guild.name)} — ${entry.reason}`)),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [summary] });
  },
};

export const broadcastCommands: Command[] = [broadcastCommand];
