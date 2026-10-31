import {
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  type ActionRowData,
  type MessageActionRowComponentData,
  SlashCommandBuilder,
} from "discord.js";
import { logger } from "../lib/logger";
import type { Command } from "../types";

export const roleRequestCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("rolerequest")
    .setDescription("Submit a whitelist application")
    .addSubcommand((sub) =>
      sub
        .setName("submit")
        .setDescription("Submit a role request application")
        .addStringOption((option) =>
          option.setName("in-game-name").setDescription("Your in-game name (used as your server nickname if approved)").setRequired(true).setMaxLength(32),
        )
        .addUserOption((option) =>
          option
            .setName("vouched-by")
            .setDescription("Vouched By — select the server member who will confirm your request")
            .setRequired(true),
        )
        .addAttachmentOption((option) =>
          option.setName("evidence").setDescription("Optional image or GIF evidence"),
        ),
    )
    .setDMPermission(false),
  adminOnly: false,
  guildOnly: true,
  defer: true,
  async execute({ interaction, guild, prisma }) {
    if (!guild) return;
    const applicant = interaction.user;
    const inGameName = interaction.options.getString("in-game-name", true);
    const voucher = interaction.options.getUser("vouched-by", true);
    const evidence = interaction.options.getAttachment("evidence");

    if (voucher.bot || voucher.id === applicant.id) {
      await interaction.editReply("Choose another server member to vouch for you.");
      return;
    }

    if (
      evidence &&
      (!evidence.contentType?.startsWith("image/") ||
        !/^https:\/\//i.test(evidence.url) ||
        evidence.size > 8 * 1024 * 1024)
    ) {
      await interaction.editReply("Evidence must be a PNG, JPEG, WebP, or GIF image smaller than 8 MB.");
      return;
    }

    const existing = await prisma.roleRequest.findFirst({
      where: {
        guildId: guild.id,
        applicantId: applicant.id,
        status: { in: ["PENDING_VOUCH", "PENDING_REVIEW", "APPROVING"] },
      },
    });
    if (existing) {
      await interaction.editReply("You already have a role request waiting for a vouch or administrator review.");
      return;
    }

    const totalApplies = (await prisma.roleRequest.count({
      where: { guildId: guild.id, applicantId: applicant.id },
    })) + 1;
    const request = await prisma.roleRequest.create({
      data: {
        guildId: guild.id,
        applicantId: applicant.id,
        applicantName: applicant.globalName ?? applicant.username,
        inGameName,
        voucherId: voucher.id,
        voucherName: voucher.globalName ?? voucher.username,
        evidenceUrl: evidence?.url ?? null,
        reviewChannelId: interaction.channelId,
      },
    });

    const applicantMember = await guild.members.fetch(applicant.id).catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: applicant.globalName ?? applicant.username,
        iconURL: applicant.displayAvatarURL(),
      })
      .setTitle("Whitelist Application")
      .addFields(
        { name: "Applicant", value: `<@${applicant.id}>`, inline: true },
        { name: "In-game Name", value: inGameName, inline: true },
        { name: "Vouched By", value: `<@${voucher.id}>`, inline: true },
        {
          name: "Joined Server",
          value:
            applicantMember?.joinedTimestamp != null
              ? `<t:${Math.floor(applicantMember.joinedTimestamp / 1000)}:R>`
              : "Unknown",
          inline: true,
        },
        { name: "Total Applies", value: String(totalApplies), inline: true },
        { name: "Status", value: `Waiting for <@${voucher.id}> to vouch`, inline: false },
        { name: "Progress", value: "● ○ Voucher confirmation\n○ Administrator approval", inline: false },
      )
      .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
      .setTimestamp(request.createdAt);

    if (evidence) {
      embed.setImage(evidence.url);
    }

    const voucherMember = await guild.members.fetch(voucher.id).catch(() => null);
    if (!voucherMember) {
      await prisma.roleRequest.delete({ where: { id: request.id } });
      await interaction.editReply("The selected voucher must be a member of this server.");
      return;
    }

    const row: ActionRowData<MessageActionRowComponentData> = {
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.Button,
          customId: `role-vouch:approve:${request.id}`,
          label: "Accept Vouch",
          style: ButtonStyle.Success,
        },
        {
          type: ComponentType.Button,
          customId: `role-vouch:deny:${request.id}`,
          label: "Deny Vouch",
          style: ButtonStyle.Danger,
        },
      ],
    };

    const channel = interaction.channel;
    if (!channel?.isTextBased() || !("send" in channel)) {
      await prisma.roleRequest.delete({ where: { id: request.id } });
      await interaction.editReply("Role requests must be submitted in a text channel where the bot can post.");
      return;
    }

    let requestMessage;
    try {
      requestMessage = await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      await prisma.roleRequest.delete({ where: { id: request.id } });
      logger.error("role-requests", `Could not post request ${request.id} in channel ${interaction.channelId}: ${(error as Error).message}`, error);
      await interaction.editReply("I couldn't post the role request in this channel. Check that I have permission to send messages and embeds.");
      return;
    }

    try {
      await prisma.roleRequest.update({
        where: { id: request.id },
        data: { reviewMessageId: requestMessage.id },
      });
    } catch (error) {
      await requestMessage.delete().catch((deleteError) =>
        logger.warn("role-requests", `Could not remove an untracked request message ${requestMessage.id}: ${(deleteError as Error).message}`),
      );
      await prisma.roleRequest.delete({ where: { id: request.id } });
      throw error;
    }

    await interaction.editReply(`Your role request is posted in <#${interaction.channelId}>. ${voucher} can confirm it there.`);
  },
};

export const roleRequestCommands: Command[] = [roleRequestCommand];
