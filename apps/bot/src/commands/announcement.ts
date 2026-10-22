import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";

export const announcementCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("announcement")
    .setDescription("Post a styled announcement")
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send an announcement to a channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Where the announcement should be posted")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Announcement text")
            .setRequired(true)
            .setMaxLength(1500),
        )
        .addAttachmentOption((option) =>
          option.setName("image").setDescription("Optional image or GIF attachment"),
        )
        .addStringOption((option) =>
          option.setName("image-url").setDescription("Optional public HTTPS image or GIF URL"),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
  guildOnly: true,
  defer: true,
  async execute({ interaction, guild }) {
    if (!guild) return;
    const selectedChannel = interaction.options.getChannel("channel", true);
    const channel = await guild.channels.fetch(selectedChannel.id);
    if (!channel || !channel.isTextBased() || !("send" in channel)) {
      await interaction.editReply({ content: "Choose a text or announcement channel." });
      return;
    }

    const message = interaction.options.getString("message", true);
    const attachment = interaction.options.getAttachment("image");
    const imageUrl = interaction.options.getString("image-url");

    if (attachment && imageUrl) {
      await interaction.editReply({ content: "Choose an uploaded image or an image URL, not both." });
      return;
    }

    let image = imageUrl;
    if (attachment) {
      if (!attachment.contentType?.startsWith("image/") || attachment.size > 8 * 1024 * 1024) {
        await interaction.editReply({ content: "Attach a PNG, JPEG, WebP, or GIF smaller than 8 MB." });
        return;
      }
      image = attachment.url;
    }

    if (image) {
      try {
        if (new URL(image).protocol !== "https:") throw new Error("HTTPS required");
      } catch {
        await interaction.editReply({ content: "Image URL must be a valid HTTPS URL." });
        return;
      }
    }

    const safeMessage = message.replaceAll("```", "``\u200b`");
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle("📢 ANNOUNCEMENT")
      .setDescription(`\`\`\`\n${safeMessage}\n\`\`\``)
      .setAuthor({
        name: interaction.user.globalName ?? interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();
    if (image) embed.setImage(image);

    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await interaction.editReply({ content: `Announcement sent to ${channel}.` });
  },
};

export const announcementCommands: Command[] = [announcementCommand];
