import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type Interaction,
  type InteractionReplyOptions,
  type RoleSelectMenuInteraction,
} from "discord.js";
import { prisma } from "../lib/db";
import { errorEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
import { isBotOwner } from "../lib/owners";
import { missingPermissions } from "../lib/permissions";
import { closeTicket, createTicket } from "../services/tickets";

function replyOptions(interaction: Interaction): InteractionReplyOptions {
  return { embeds: [errorEmbed("Something went wrong.")], ephemeral: true };
}

export async function handleInteraction(client: Client, interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(client, interaction);
    return;
  }

  if (interaction.isButton()) {
    try {
      await handleButton(client, interaction);
    } catch (error) {
      logger.error("interactions", `Button ${interaction.customId} failed: ${(error as Error).message}`, error);
      await replyInteractionError(interaction);
    }
    return;
  }

  if (interaction.isRoleSelectMenu()) {
    try {
      await handleRoleSelect(interaction);
    } catch (error) {
      logger.error("interactions", `Role selection ${interaction.customId} failed: ${(error as Error).message}`, error);
      await replyInteractionError(interaction);
    }
  }
}

async function replyInteractionError(
  interaction: ButtonInteraction | RoleSelectMenuInteraction,
): Promise<void> {
  const reply = { content: "Could not process that action. Please try again.", ephemeral: true };
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  } catch (error) {
    logger.warn("interactions", `Could not send an interaction error response: ${(error as Error).message}`);
  }
}

async function handleCommand(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply(replyOptions(interaction));
    return;
  }

  try {
    const ownerOnly = command.ownerOnly === true;

    if (ownerOnly) {
      if (!(await isBotOwner(client, interaction.user.id))) {
        await interaction.reply({
          embeds: [errorEmbed("This command is restricted to the bot owner.")],
          ephemeral: true,
        });
        return;
      }
    } else {
      if (!interaction.inGuild()) {
        await interaction.reply({
          embeds: [errorEmbed("Slash commands are only available to server Administrators.")],
          ephemeral: true,
        });
        return;
      }

      if (
        command.adminOnly !== false &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      ) {
        await interaction.reply({
          embeds: [errorEmbed("Only server Administrators can use this slash command.")],
          ephemeral: true,
        });
        return;
      }

      const permissions = interaction.memberPermissions;
      if (permissions && command.userPermissions?.length) {
        const hasAdmin = permissions.has(PermissionFlagsBits.Administrator);
        if (!hasAdmin) {
          const missing = command.userPermissions.filter((permission) => !permissions.has(permission));
          if (missing.length > 0) {
            await interaction.reply({
              embeds: [errorEmbed("You do not have the required permissions.", missing.join(", "))],
              ephemeral: true,
            });
            return;
          }
        }
      }
    }

    const guild = interaction.guild;
    if (guild && command.botPermissions?.length) {
      const me = guild.members.me;
      const missing = me ? missingPermissions(me, command.botPermissions) : ["bot"];
      if (missing.length > 0) {
        await interaction.reply({
          embeds: [errorEmbed("I am missing some permissions.", missing.join(", "))],
          ephemeral: true,
        });
        return;
      }
    }

    if (command.defer) {
      await interaction.deferReply({ ephemeral: true });
    }

    await command.execute({
      interaction,
      client,
      guild,
      prisma,
    });

    await prisma.commandStat
      .upsert({
        where: { guildId_name: { guildId: guild?.id ?? "dm", name: command.data.name } },
        update: { count: { increment: 1 } },
        create: { guildId: guild?.id ?? "dm", name: command.data.name, count: 1 },
      })
      .catch(() => undefined);
  } catch (error) {
    logger.error("commands", `/${interaction.commandName} failed: ${(error as Error).message}`, error);
    const content = error instanceof Error ? error.message : "Unknown error";
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ embeds: [errorEmbed("The command failed.", content)], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed("The command failed.", content)], ephemeral: true });
      }
    } catch {
      /* ignore */
    }
  }
}

async function handleRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
  const [, action, requestId] = interaction.customId.split(":");
  const guild = interaction.guild;
  if (
    action !== "assign" ||
    !requestId ||
    !guild ||
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({
      content: "Only server Administrators can assign a role to a request.",
      ephemeral: true,
    });
    return;
  }

  const roleId = interaction.values[0];
  const role = guild.roles.cache.get(roleId);
  if (!role || role.id === guild.id || role.managed) {
    await interaction.reply({ content: "Choose a valid, assignable role from this server.", ephemeral: true });
    return;
  }

  const claim = await prisma.roleRequest.updateMany({
    where: { id: requestId, guildId: guild.id, status: "PENDING_REVIEW" },
    data: { status: "APPROVING", roleId },
  });
  if (claim.count !== 1) {
    await interaction.reply({
      content: "This role request is no longer waiting for review.",
      ephemeral: true,
    });
    return;
  }

  const request = await prisma.roleRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new Error(`Role request ${requestId} disappeared while being approved.`);
  }

  let applicant: GuildMember;
  try {
    applicant = await guild.members.fetch(request.applicantId);
    await applicant.roles.add(roleId);
  } catch (error) {
    await prisma.roleRequest.updateMany({
      where: { id: requestId, guildId: guild.id, status: "APPROVING" },
      data: { status: "PENDING_REVIEW", roleId: null },
    });
    logger.error("role-requests", `Could not assign role for request ${requestId}: ${(error as Error).message}`, error);
    await interaction.reply({
      content: "Could not assign the role. Check that the bot has Manage Roles and its highest role is above the selected role.",
      ephemeral: true,
    });
    return;
  }

  let nicknameError: string | null = null;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

  if (guild.ownerId === request.applicantId) {
    nicknameError = "Discord does not allow changing the server owner's nickname";
  } else if (request.inGameName.length > 32) {
    nicknameError = "the requested in-game name exceeds Discord's 32-character nickname limit";
  } else if (!me) {
    nicknameError = "the bot is not a member of this server";
  } else if (
    !me.permissions.has(PermissionFlagsBits.ManageNicknames) &&
    !me.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    nicknameError = "the bot needs the Manage Nicknames permission";
  } else if (applicant.roles.highest.position >= me.roles.highest.position) {
    nicknameError = `the applicant's highest role “${applicant.roles.highest.name}” (position ${applicant.roles.highest.position}) is not below the bot's highest role “${me.roles.highest.name}” (position ${me.roles.highest.position}), so Discord does not allow the bot to change their nickname. Give the bot an additional role above “${applicant.roles.highest.name}” in Server Settings → Roles to enable nickname changes`;
  } else {
    try {
      await applicant.setNickname(request.inGameName, `Role request ${requestId} approved`);
    } catch (error) {
      nicknameError = (error as Error).message;
      logger.warn(
        "role-requests",
        `Role ${roleId} was granted, but nickname could not be changed for request ${requestId}: ${nicknameError}`,
        error,
      );
    }
  }

  await prisma.roleRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", decidedBy: interaction.user.id, decidedAt: new Date() },
  });
  await interaction.reply({
    content: nicknameError
      ? `Granted <@&${roleId}> to <@${request.applicantId}>, but the nickname could not be changed: ${nicknameError}`
      : `Granted <@&${roleId}> to <@${request.applicantId}> and changed their server nickname to **${request.inGameName}**.`,
    ephemeral: true,
  });

  try {
    if (request.reviewChannelId && request.reviewMessageId) {
      const channel = await guild.channels.fetch(request.reviewChannelId);
      if (channel?.isTextBased() && "messages" in channel) {
        const reviewMessage = await channel.messages.fetch(request.reviewMessageId);
        const embed = reviewMessage.embeds[0]
          ? EmbedBuilder.from(reviewMessage.embeds[0].toJSON())
          : null;
        if (embed) {
          const status = nicknameError
            ? `Approved by <@${interaction.user.id}> — <@&${roleId}> granted; nickname not changed: ${nicknameError}`
            : `Approved by <@${interaction.user.id}> — <@&${roleId}> granted; nickname set to ${request.inGameName}`;
          setReviewStatus(embed, status);
          await reviewMessage.edit({ embeds: [embed], components: [] });
        }
      }
    }
  } catch (error) {
    logger.warn("role-requests", `Could not update review message for request ${requestId}: ${(error as Error).message}`, error);
  }
}

function setReviewStatus(embed: EmbedBuilder, status: string): void {
  const data = embed.toJSON();
  const fields = (data.fields ?? []).map((field) =>
    field.name === "Status" ? { ...field, value: status } : field,
  );
  embed.setFields(fields);
}

async function handleButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  const [namespace, action, id] = interaction.customId.split(":");

  if (namespace === "role-review") {
    await handleRoleReview(interaction, action, id);
    return;
  }

  if (namespace === "role-vouch") {
    await handleRoleVouch(interaction, action, id);
    return;
  }

  async function handleRoleReview(
    interaction: ButtonInteraction,
    action: string | undefined,
    requestId: string | undefined,
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "Only server Administrators can review role requests.",
        ephemeral: true,
      });
      return;
    }

    if (!requestId || (action !== "approve" && action !== "deny")) {
      await interaction.reply({ content: "This role review action is invalid.", ephemeral: true });
      return;
    }

    const request = await prisma.roleRequest.findFirst({
      where: { id: requestId, guildId: guild.id, status: "PENDING_REVIEW" },
    });
    if (!request) {
      await interaction.reply({
        content: "This role request is no longer waiting for review.",
        ephemeral: true,
      });
      return;
    }

    if (action === "deny") {
      const result = await prisma.roleRequest.updateMany({
        where: { id: requestId, guildId: guild.id, status: "PENDING_REVIEW" },
        data: { status: "DENIED", decidedBy: interaction.user.id, decidedAt: new Date() },
      });
      if (result.count !== 1) {
        await interaction.reply({ content: "This request has already been reviewed.", ephemeral: true });
        return;
      }

      const embed = interaction.message.embeds[0]
        ? EmbedBuilder.from(interaction.message.embeds[0].toJSON())
        : null;
      if (embed) {
        setReviewStatus(embed, `Denied by <@${interaction.user.id}>`);
        await interaction.update({ embeds: [embed], components: [] });
      } else {
        await interaction.update({ content: "Role request denied.", components: [] });
      }
      return;
    }

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId(`role-review:assign:${requestId}`)
      .setPlaceholder("Choose the role to grant")
      .setMinValues(1)
      .setMaxValues(1);
    await interaction.reply({
      content: `Choose a role to grant to <@${request.applicantId}>:`,
      components: [{ type: ComponentType.ActionRow, components: [roleSelect] }],
      ephemeral: true,
    });
  }

  if (namespace !== "ticket") return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("This button only works in a server.")], ephemeral: true });
    return;
  }

  async function handleRoleVouch(
    interaction: ButtonInteraction,
    action: string | undefined,
    requestId: string | undefined,
  ): Promise<void> {
    if (!requestId || (action !== "approve" && action !== "deny")) {
      await interaction.reply({ content: "This vouch button is invalid.", ephemeral: true });
      return;
    }

    try {
      const request = await prisma.roleRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        await interaction.reply({ content: "This role request no longer exists.", ephemeral: true });
        return;
      }

      if (interaction.user.id !== request.voucherId) {
        await interaction.reply({ content: "Only the person named as the voucher can respond.", ephemeral: true });
        return;
      }

      const status = action === "approve" ? "PENDING_REVIEW" : "DENIED";
      const result = await prisma.roleRequest.updateMany({
        where: { id: requestId, status: "PENDING_VOUCH" },
        data: {
          status,
          decidedBy: action === "deny" ? interaction.user.id : null,
          decidedAt: action === "deny" ? new Date() : null,
        },
      });

      if (result.count !== 1) {
        await interaction.reply({ content: "This request has already received a vouch response.", ephemeral: true });
        return;
      }

      const currentEmbed = interaction.message.embeds[0];
      if (!currentEmbed) {
        await interaction.update({ content: "Vouch response recorded.", components: [] });
        return;
      }

      const embed = EmbedBuilder.from(currentEmbed.toJSON());
      const updatedFields = currentEmbed.fields.map((field) => {
        if (field.name === "Status") {
          return {
            name: field.name,
            value:
              action === "approve"
                ? `Vouched by <@${request.voucherId}>`
                : `Vouch denied by <@${request.voucherId}>`,
            inline: field.inline,
          };
        }
        if (field.name === "Progress") {
          return {
            name: field.name,
            value:
              action === "approve"
                ? "● ● ○ Vouch accepted\n○ Waiting for Administrator approval"
                : "● ✗ Vouch denied\n○ Administrator approval not available",
            inline: field.inline,
          };
        }
        return { name: field.name, value: field.value, inline: field.inline };
      });
      embed.setFields(updatedFields);
      const reviewComponents = action === "approve"
        ? [{
            type: ComponentType.ActionRow as const,
            components: [
              new ButtonBuilder()
                .setCustomId(`role-review:approve:${request.id}`)
                .setLabel("Approve & assign role")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`role-review:deny:${request.id}`)
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger),
            ],
          }]
        : [];
      await interaction.update({ embeds: [embed], components: reviewComponents });
    } catch (error) {
      logger.error("role-requests", `Vouch ${interaction.customId} failed: ${(error as Error).message}`, error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "Could not process this vouch. Please try again.", ephemeral: true });
      } else {
        await interaction.reply({ content: "Could not process this vouch. Please try again.", ephemeral: true });
      }
    }
  }

  try {
    if (action === "create") {
      await interaction.deferReply({ ephemeral: true });
      const member = interaction.member as GuildMember | null;
      if (!member) return;

      const result = await createTicket(guild, member, id);
      await interaction.editReply({
        embeds: [
          {
            title: "Ticket created",
            color: 0x22c55e,
            description: `Your ticket is ready: <#${result.channelId}>`,
            footer: { text: "GuardBot" },
          },
        ],
      });
      return;
    }

    if (action === "close") {
      await interaction.deferReply({ ephemeral: true });
      await closeTicket(guild, id, interaction.user.id);
      await interaction.editReply({
        embeds: [
          {
            title: "Ticket closed",
            color: 0x22c55e,
            description: "The transcript has been saved and the channel has been archived.",
            footer: { text: "GuardBot" },
          },
        ],
      });
    }
  } catch (error) {
    logger.error("tickets", `Button ${interaction.customId} failed: ${(error as Error).message}`);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed("The ticket action failed.", (error as Error).message)] });
      } else {
        await interaction.reply({ embeds: [errorEmbed("The ticket action failed.", (error as Error).message)], ephemeral: true });
      }
    } catch {
      /* ignore */
    }
  }
}
