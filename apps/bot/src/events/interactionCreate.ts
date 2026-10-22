import {
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
  type Interaction,
  type InteractionReplyOptions,
} from "discord.js";
import { prisma } from "../lib/db";
import { errorEmbed } from "../lib/embeds";
import { logger } from "../lib/logger";
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
    await handleButton(client, interaction);
  }
}

async function handleCommand(client: Client, interaction: ChatInputCommandInteraction): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply(replyOptions(interaction));
    return;
  }

  try {
    if (command.guildOnly && !interaction.inGuild()) {
      await interaction.reply({ embeds: [errorEmbed("This command only works in a server.")], ephemeral: true });
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

async function handleButton(client: Client, interaction: ButtonInteraction): Promise<void> {
  const [namespace, action, id] = interaction.customId.split(":");

  if (namespace === "role-vouch") {
    await handleRoleVouch(client, interaction, action, id);
    return;
  }

  if (namespace !== "ticket") return;

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("This button only works in a server.")], ephemeral: true });
    return;
  }

  async function handleRoleVouch(
    client: Client,
    interaction: ButtonInteraction,
    action: string | undefined,
    requestId: string | undefined,
  ): Promise<void> {
    if (!requestId || (action !== "approve" && action !== "deny")) {
      await interaction.reply({ content: "This vouch button is invalid." });
      return;
    }

    try {
      const request = await prisma.roleRequest.findUnique({ where: { id: requestId } });
      if (!request) {
        await interaction.reply({ content: "This role request no longer exists." });
        return;
      }

      if (interaction.user.id !== request.voucherId) {
        await interaction.reply({ content: "Only the person named as the voucher can respond." });
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
        await interaction.reply({ content: "This request has already received a vouch response." });
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
      await interaction.update({ embeds: [embed], components: [] });

      if (action === "approve") {
        const applicant = await client.users.fetch(request.applicantId);
        await applicant
          .send(`Your role request in **${interaction.client.guilds.cache.get(request.guildId)?.name ?? "the server"}** has been vouched for and is waiting for an Administrator.`)
          .catch((error) =>
            logger.warn("role-requests", `Could not notify applicant ${request.applicantId}: ${(error as Error).message}`),
          );
      }
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
