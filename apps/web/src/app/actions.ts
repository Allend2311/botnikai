"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AUTOMOD_ACTIONS,
  STREAM_PLATFORMS,
  type AutomodAction,
} from "@guardbot/shared";
import { Prisma } from "@prisma/client";
import { WEBSITE_NAME } from "@/lib/brand";
import { requireBotOwner, requireGuildAdministrator, requireGuildManager } from "@/lib/auth";
import {
  addGuildMemberRole,
  createChannelMessage,
  DiscordApiError,
  editChannelMessage,
  findRoleRequestMessages,
  getGuildChannels,
  getGuildRoles,
  getMemberHighestRole,
  getRoleAssignmentCapabilities,
  roleAssignmentBlocker,
  setGuildMemberNickname,
} from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { destroySession } from "@/lib/session";

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bool(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function num(formData: FormData, key: string, fallback = 0): number {
  const value = Number(str(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Reads a multi-value field. Works for comma / newline separated text inputs as
 * well as for checkbox groups that share the same `name`.
 */
function list(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(/[\n,]/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function nullable(value: string): string | null {
  return value.length > 0 ? value : null;
}

function optionalHttpsImageUrl(value: string, fieldName: string): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid HTTPS image URL.`);
  }

  const isDatabaseImage = /^\/api\/welcome-images\/[a-zA-Z0-9_-]{8,64}$/.test(url.pathname);
  let isLocalDevelopmentImage = false;
  if (process.env.NODE_ENV !== "production" && isDatabaseImage) {
    try {
      const appUrl = new URL(process.env.APP_URL ?? "http://localhost:3000");
      isLocalDevelopmentImage = url.origin === appUrl.origin && appUrl.protocol === "http:";
    } catch {
      isLocalDevelopmentImage = false;
    }
  }

  if (url.protocol !== "https:" && !isLocalDevelopmentImage) {
    throw new Error(`${fieldName} must use HTTPS.`);
  }

  return url.toString();
}

function refresh(guildId: string, ...paths: string[]): void {
  revalidatePath(`/dashboard/${guildId}`);
  for (const path of paths) {
    revalidatePath(`/dashboard/${guildId}/${path}`);
  }
}

async function syncRoleRequestMessage(
  request: {
    id: string;
    applicantId: string;
    inGameName: string;
    voucherId: string;
    evidenceUrl: string | null;
    reviewChannelId: string | null;
    reviewMessageId: string | null;
    createdAt: Date;
  },
  status: string,
  progress: string,
): Promise<void> {
  if (!request.reviewChannelId) {
    throw new Error(`Role request ${request.id} has no saved Discord channel, so its message could not be updated.`);
  }

  const payload = {
    embeds: [
      {
        title: status.startsWith("Approved")
          ? "Role request approved"
          : status.startsWith("Denied")
            ? "Role request denied"
            : "Whitelist Application",
        color: 0x5865f2,
        fields: [
          { name: "Applicant", value: `<@${request.applicantId}>`, inline: true },
          { name: "In-game name", value: request.inGameName, inline: true },
          { name: "Vouched by", value: `<@${request.voucherId}>`, inline: true },
          { name: "Status", value: status },
          { name: "Progress", value: progress },
        ],
        ...(request.evidenceUrl ? { image: { url: request.evidenceUrl } } : {}),
        timestamp: request.createdAt.toISOString(),
      },
    ],
    components: [],
  };

  let directUpdateError: unknown;
  if (request.reviewMessageId) {
    try {
      const updated = await editChannelMessage(request.reviewChannelId, request.reviewMessageId, payload);
      if (updated.components && updated.components.length > 0) {
        throw new Error("Discord returned the message with interactive components still attached.");
      }
      return;
    } catch (error) {
      directUpdateError = error;
    }
  }

  let fallbackMessageIds: string[];
  try {
    fallbackMessageIds = await findRoleRequestMessages(request.reviewChannelId, request);
  } catch (error) {
    throw new Error(
      `The role was processed, but Discord message lookup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const messageIds = fallbackMessageIds.length > 0
    ? fallbackMessageIds
    : request.reviewMessageId
      ? [request.reviewMessageId]
      : [];
  if (messageIds.length === 0) {
    throw new Error(
      `The role was processed, but the request message was not found in channel ${request.reviewChannelId}.`,
    );
  }

  const updateErrors: string[] = [];
  let updatedMessageId: string | null = null;
  for (const messageId of messageIds) {
    try {
      const updated = await editChannelMessage(request.reviewChannelId, messageId, payload);
      if (updated.components && updated.components.length > 0) {
        throw new Error("Discord returned the message with interactive components still attached.");
      }
      updatedMessageId ??= messageId;
    } catch (error) {
      updateErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!updatedMessageId) {
    const reason = updateErrors[0] ?? (directUpdateError instanceof Error ? directUpdateError.message : "Unknown Discord API error");
    throw new Error(`The role was processed, but Discord did not update the request message: ${reason}`);
  }

  await prisma.roleRequest.update({
    where: { id: request.id },
    data: { reviewMessageId: updatedMessageId },
  });
}

export interface RoleRequestActionState {
  status: "idle" | "success" | "error";
  message: string;
}

function actionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  const text = String(error);
  return text && text !== "[object Object]" ? text : "Something went wrong. Please try again.";
}

function roleGrantErrorMessage(error: unknown): string {
  if (error instanceof DiscordApiError) {
    if (error.status === 401) {
      return "Discord rejected the bot token. Check that DISCORD_TOKEN is set correctly in the deployment environment.";
    }
    if (error.code === 50013 || error.status === 403) {
      return "Discord refused the role change (Missing Permissions). The bot needs the Manage Roles permission, and its own role must be above the role you are assigning.";
    }
    if (error.code === 10007 || error.status === 404) {
      return "That member is no longer in this server.";
    }
    if (error.code === 10011) {
      return "That role no longer exists in this server. Pick another role and try again.";
    }
  }

  return `Discord could not assign the role: ${actionErrorMessage(error)}`;
}

function nicknameErrorMessage(error: unknown): string {
  if (error instanceof DiscordApiError) {
    if (error.code === 50013 || error.status === 403) {
      return "Discord refused the nickname change (Missing Permissions). The bot needs Manage Nicknames, and its own role must be above the applicant's highest role.";
    }
    if (error.code === 10007 || error.status === 404) {
      return "That member is no longer in this server.";
    }
  }

  return actionErrorMessage(error);
}

export async function approveRoleRequest(
  guildId: string,
  requestId: string,
  _previousState: RoleRequestActionState,
  formData: FormData,
): Promise<RoleRequestActionState> {
  try {
    const { user } = await requireGuildAdministrator(guildId);
    const roleId = str(formData, "roleId");
    if (!roleId) {
      return { status: "error", message: "Select a role before approving this request." };
    }

    const roles = await getGuildRoles(guildId);
    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) {
      return { status: "error", message: "Choose a valid, assignable role from this server." };
    }

    const capabilities = await getRoleAssignmentCapabilities(guildId, roles);
    const blocker = roleAssignmentBlocker(role, capabilities, guildId);
    if (blocker) {
      return { status: "error", message: blocker };
    }

    const request = await prisma.roleRequest.findFirst({
      where: { id: requestId, guildId, status: "PENDING_REVIEW" },
    });
    if (!request) {
      return { status: "error", message: "This role request is no longer waiting for review." };
    }

    const claim = await prisma.roleRequest.updateMany({
      where: { id: requestId, guildId, status: "PENDING_REVIEW" },
      data: { status: "APPROVING", roleId },
    });
    if (claim.count !== 1) {
      return { status: "error", message: "This role request is already being reviewed." };
    }

    try {
      await addGuildMemberRole(guildId, request.applicantId, roleId);
    } catch (error) {
      await prisma.roleRequest
        .updateMany({
          where: { id: requestId, guildId, status: "APPROVING" },
          data: { status: "PENDING_REVIEW" },
        })
        .catch(() => undefined);
      console.error(
        `[role-requests] Could not assign role ${roleId} to ${request.applicantId} in ${guildId}:`,
        error,
      );
      return { status: "error", message: roleGrantErrorMessage(error) };
    }

    let nicknameError: string | null = null;
    const applicantIsOwner = capabilities.ownerId === request.applicantId;
    const applicantHighestRole =
      applicantIsOwner || request.inGameName.length > 32
        ? null
        : await getMemberHighestRole(guildId, request.applicantId, roles);

    if (applicantIsOwner) {
      nicknameError = "Discord does not allow changing the server owner's nickname";
    } else if (request.inGameName.length > 32) {
      nicknameError = "the requested in-game name exceeds Discord's 32-character nickname limit";
    } else if (applicantHighestRole === null) {
      nicknameError = "that member is no longer in this server";
    } else if (!capabilities.hasManageNicknames && !capabilities.hasAdministrator) {
      nicknameError = "the bot needs the Manage Nicknames permission";
    } else if (applicantHighestRole.position >= capabilities.highestRolePosition) {
      nicknameError = `the applicant's highest role “${applicantHighestRole.name}” (position ${applicantHighestRole.position}) is not below the bot's highest role “${capabilities.highestRoleName}” (position ${capabilities.highestRolePosition}), so Discord does not allow the bot to change their nickname. Give the bot an additional role above “${applicantHighestRole.name}” in Server Settings → Roles to enable nickname changes`;
    } else {
      try {
        await setGuildMemberNickname(guildId, request.applicantId, request.inGameName);
      } catch (error) {
        nicknameError = nicknameErrorMessage(error);
        console.warn(
          `[role-requests] Role ${roleId} was granted, but nickname could not be changed for request ${requestId}:`,
          error,
        );
      }
    }

    await prisma.roleRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", decidedBy: user.discordId, decidedAt: new Date() },
    });

    let messageWarning = "";
    try {
      await syncRoleRequestMessage(
        request,
        nicknameError
          ? `Approved by <@${user.discordId}> — <@&${roleId}> granted; nickname not changed: ${nicknameError}`
          : `Approved by <@${user.discordId}> — <@&${roleId}> granted; nickname set to ${request.inGameName}`,
        "● ● ● Administrator approved",
      );
    } catch (error) {
      messageWarning = actionErrorMessage(error);
      console.error(
        `[role-requests] Role ${roleId} was granted for request ${requestId}, but the Discord review message could not be updated:`,
        error,
      );
    }

    refresh(guildId, "role-requests");

    const granted = `Role “${role.name}” granted to ${request.applicantName}.`;
    return {
      status: "success",
      message: messageWarning
        ? `${granted} The Discord review message could not be updated: ${messageWarning}`
        : granted,
    };
  } catch (error) {
    console.error(`[role-requests] Approve failed for request ${requestId} in ${guildId}:`, error);
    return { status: "error", message: actionErrorMessage(error) };
  }
}

export async function denyRoleRequest(
  guildId: string,
  requestId: string,
  _previousState: RoleRequestActionState,
): Promise<RoleRequestActionState> {
  try {
    const { user } = await requireGuildAdministrator(guildId);
    const request = await prisma.roleRequest.findFirst({
      where: { id: requestId, guildId, status: "PENDING_REVIEW" },
    });
    if (!request) {
      return { status: "error", message: "This role request is no longer waiting for review." };
    }

    const result = await prisma.roleRequest.updateMany({
      where: { id: requestId, guildId, status: "PENDING_REVIEW" },
      data: { status: "DENIED", decidedBy: user.discordId, decidedAt: new Date() },
    });

    if (result.count !== 1) {
      return { status: "error", message: "This role request is no longer waiting for review." };
    }

    let messageWarning = "";
    try {
      await syncRoleRequestMessage(
        request,
        `Denied by <@${user.discordId}>`,
        "● ● ✗ Administrator denied",
      );
    } catch (error) {
      messageWarning = actionErrorMessage(error);
      console.error(
        `[role-requests] Request ${requestId} was denied, but the Discord review message could not be updated:`,
        error,
      );
    }

    refresh(guildId, "role-requests");
    return {
      status: "success",
      message: messageWarning
        ? `Request denied. The Discord review message could not be updated: ${messageWarning}`
        : "Request denied.",
    };
  } catch (error) {
    console.error(`[role-requests] Deny failed for request ${requestId} in ${guildId}:`, error);
    return { status: "error", message: actionErrorMessage(error) };
  }
}

export async function addLiveStreamAccount(guildId: string, formData: FormData): Promise<void> {
  await requireBotOwner();
  await requireGuildManager(guildId);
  const platform = str(formData, "platform");
  const username = str(formData, "username").replace(/^@+/, "");

  if (!STREAM_PLATFORMS.includes(platform as (typeof STREAM_PLATFORMS)[number])) {
    throw new Error("Choose a supported streaming platform.");
  }
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(username)) {
    throw new Error("Enter a valid username without a URL.");
  }

  try {
    await prisma.liveStreamAccount.create({ data: { guildId, platform, username } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("That account has already been added to this server.");
    }
    throw error;
  }

  refresh(guildId, "notifications");
}

export async function removeLiveStreamAccount(guildId: string, accountId: string): Promise<void> {
  await requireBotOwner();
  await requireGuildManager(guildId);
  const result = await prisma.liveStreamAccount.deleteMany({ where: { id: accountId, guildId } });
  if (result.count !== 1) {
    throw new Error("This streaming account was not found.");
  }

  refresh(guildId, "notifications");
}

// ---------------------------------------------------------------------------
// Message templates
// ---------------------------------------------------------------------------

export interface MessageTemplateActionState {
  status: "idle" | "success" | "error";
  message: string;
  templateId?: string;
}

export async function saveMessageTemplate(
  guildId: string,
  templateId: string | null,
  _previousState: MessageTemplateActionState,
  formData: FormData,
): Promise<MessageTemplateActionState> {
  await requireGuildManager(guildId);

  const name = str(formData, "name");
  const contentValue = formData.get("content");
  const content = typeof contentValue === "string" ? contentValue : "";
  const embedTitle = str(formData, "embedTitle");
  const embedDescriptionValue = formData.get("embedDescription");
  const embedDescription = typeof embedDescriptionValue === "string" ? embedDescriptionValue : "";

  if (!name || name.length > 80) {
    return { status: "error", message: "Template name must be between 1 and 80 characters." };
  }
  if (content.length > 2000) {
    return { status: "error", message: "Message content cannot exceed 2,000 characters." };
  }
  if (embedTitle.length > 256) {
    return { status: "error", message: "Embed title cannot exceed 256 characters." };
  }
  if (embedDescription.length > 4096) {
    return { status: "error", message: "Embed description cannot exceed 4,096 characters." };
  }
  if (!content.trim() && !embedTitle && !embedDescription.trim()) {
    return { status: "error", message: "Add message content or an embed before saving." };
  }

  const data = {
    name,
    content,
    embedTitle: nullable(embedTitle),
    embedDescription: nullable(embedDescription),
  };

  if (templateId) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { id: templateId, guildId },
      select: { id: true },
    });
    if (!existing) {
      return { status: "error", message: "This template was not found in this server." };
    }

    const saved = await prisma.messageTemplate.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
    refresh(guildId, "messages");
    return { status: "success", message: "Template saved.", templateId: saved.id };
  }

  const templateCount = await prisma.messageTemplate.count({ where: { guildId } });
  if (templateCount >= 100) {
    return { status: "error", message: "This server has reached the 100-template limit." };
  }

  const saved = await prisma.messageTemplate.create({
    data: { guildId, ...data },
    select: { id: true },
  });
  refresh(guildId, "messages");
  return { status: "success", message: "Template created.", templateId: saved.id };
}

export async function sendMessageTemplate(
  guildId: string,
  templateId: string,
  _previousState: MessageTemplateActionState,
  formData: FormData,
): Promise<MessageTemplateActionState> {
  await requireGuildManager(guildId);

  const channelId = str(formData, "channelId");
  if (!channelId) {
    return { status: "error", message: "Choose a channel first." };
  }

  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, guildId },
  });
  if (!template) {
    return { status: "error", message: "This template was not found in this server." };
  }

  const channels = await getGuildChannels(guildId);
  const channel = channels.find((item) => item.id === channelId);
  if (!channel || ![0, 5].includes(channel.type)) {
    return { status: "error", message: "Choose a text or announcement channel in this server." };
  }

  const embeds = template.embedTitle || template.embedDescription
    ? [{
        color: 0x6366f1,
        ...(template.embedTitle ? { title: template.embedTitle } : {}),
        ...(template.embedDescription ? { description: template.embedDescription } : {}),
        footer: { text: template.name },
      }]
    : undefined;

  await createChannelMessage(channelId, {
    ...(template.content ? { content: template.content } : {}),
    ...(embeds ? { embeds } : {}),
    allowedMentions: { parse: [] },
  });

  return { status: "success", message: `“${template.name}” sent to #${channel.name}.` };
}

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------

export async function saveGeneralSettings(guildId: string, formData: FormData): Promise<void> {
  await requireGuildManager(guildId);

  await prisma.guildSettings.upsert({
    where: { guildId },
    update: {
      modLogChannelId: nullable(str(formData, "modLogChannelId")),
      ticketLogChannelId: nullable(str(formData, "ticketLogChannelId")),
      activityLogChannelId: nullable(str(formData, "activityLogChannelId")),
    },
    create: {
      guildId,
      modLogChannelId: nullable(str(formData, "modLogChannelId")),
      ticketLogChannelId: nullable(str(formData, "ticketLogChannelId")),
      activityLogChannelId: nullable(str(formData, "activityLogChannelId")),
    },
  });

  refresh(guildId, "settings");
}

// ---------------------------------------------------------------------------
// Auto-mod
// ---------------------------------------------------------------------------

export async function saveAutomod(guildId: string, formData: FormData): Promise<void> {
  await requireGuildManager(guildId);

  const action = (value: string): AutomodAction =>
    (AUTOMOD_ACTIONS as readonly string[]).includes(value) ? (value as AutomodAction) : "DELETE";

  const data = {
    enabled: bool(formData, "enabled"),
    blockInvites: bool(formData, "blockInvites"),
    blockExternalLinks: bool(formData, "blockExternalLinks"),
    allowedDomains: JSON.stringify(list(formData, "allowedDomains")),
    maxCapsPercent: Math.min(100, Math.max(0, num(formData, "maxCapsPercent", 50))),
    blockCaps: bool(formData, "blockCaps"),
    spamMaxMessages: Math.max(2, num(formData, "spamMaxMessages", 5)),
    spamWindowSeconds: Math.max(1, num(formData, "spamWindowSeconds", 7)),
    bannedWords: JSON.stringify(list(formData, "bannedWords")),
    ignoreChannels: JSON.stringify(list(formData, "ignoreChannels")),
    ignoreRoles: JSON.stringify(list(formData, "ignoreRoles")),
    actionLink: action(str(formData, "actionLink")),
    actionSpam: action(str(formData, "actionSpam")),
    actionWord: action(str(formData, "actionWord")),
    actionCaps: action(str(formData, "actionCaps")),
    warnLimit: Math.max(1, num(formData, "warnLimit", 3)),
    timeoutMinutes: Math.max(1, num(formData, "timeoutMinutes", 10)),
  };

  await prisma.automodConfig.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });

  refresh(guildId, "moderation");
}

// ---------------------------------------------------------------------------
// Welcome / roles
// ---------------------------------------------------------------------------

export async function saveWelcome(guildId: string, formData: FormData): Promise<void> {
  await requireGuildManager(guildId);

  const autoRoleIds = JSON.stringify(list(formData, "autoRoleIds"));

  const data = {
    welcomeEnabled: bool(formData, "welcomeEnabled"),
    welcomeChannelId: nullable(str(formData, "welcomeChannelId")),
    welcomeMessage: str(formData, "welcomeMessage"),
    welcomeImageUrl: optionalHttpsImageUrl(str(formData, "welcomeImageUrl"), "Welcome image URL"),
    dmOnJoin: bool(formData, "dmOnJoin"),
    welcomeDmMessage: nullable(str(formData, "welcomeDmMessage")),
    goodbyeEnabled: bool(formData, "goodbyeEnabled"),
    goodbyeChannelId: nullable(str(formData, "goodbyeChannelId")),
    goodbyeMessage: str(formData, "goodbyeMessage"),
    goodbyeImageUrl: optionalHttpsImageUrl(str(formData, "goodbyeImageUrl"), "Farewell image URL"),
    autoRoleIds,
  };

  await prisma.guildSettings.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });

  refresh(guildId, "welcome");
}

export async function addReactionRole(guildId: string, formData: FormData): Promise<void> {
  await requireGuildManager(guildId);

  const channelId = str(formData, "channelId");
  const emoji = str(formData, "emoji");
  const roleId = str(formData, "roleId");

  if (!channelId || !emoji || !roleId) {
    throw new Error("Channel, emoji and role are required.");
  }

  const existing = await prisma.reactionRole.findFirst({
    where: { guildId, channelId, emoji },
  });

  if (existing) {
    await prisma.reactionRole.update({ where: { id: existing.id }, data: { roleId } });
  } else {
    await prisma.reactionRole.create({ data: { guildId, channelId, emoji, roleId } });
  }

  refresh(guildId, "welcome");
}

export async function removeReactionRole(guildId: string, roleId: string): Promise<void> {
  await requireGuildManager(guildId);
  await prisma.reactionRole.deleteMany({ where: { guildId, id: roleId } });
  refresh(guildId, "welcome");
}

// ---------------------------------------------------------------------------
// Notifications (live + posts)
// ---------------------------------------------------------------------------

export async function saveNotifications(guildId: string, formData: FormData): Promise<void> {
  await requireBotOwner();
  await requireGuildManager(guildId);

  const data = {
    liveEnabled: bool(formData, "liveEnabled"),
    liveChannelId: nullable(str(formData, "liveChannelId")),
    liveRoleId: nullable(str(formData, "liveRoleId")),
    livePingEveryone: bool(formData, "livePingEveryone"),
    livePingHere: bool(formData, "livePingHere"),
    liveAnnounceEnd: bool(formData, "liveAnnounceEnd"),
    liveIncludeUrl: bool(formData, "liveIncludeUrl"),
    postEnabled: bool(formData, "postEnabled"),
    postForumChannelId: nullable(str(formData, "postForumChannelId")),
    postWatchChannelId: nullable(str(formData, "postWatchChannelId")),
    postChannelId: nullable(str(formData, "postChannelId")),
    postRoleId: nullable(str(formData, "postRoleId")),
    postPingEveryone: bool(formData, "postPingEveryone"),
    postPingHere: bool(formData, "postPingHere"),
    postPingAuthor: bool(formData, "postPingAuthor"),
    postIncludeContent: bool(formData, "postIncludeContent"),
  };

  await prisma.guildSettings.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });

  refresh(guildId, "notifications");
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function saveTicketSettings(guildId: string, formData: FormData): Promise<void> {
  await requireGuildManager(guildId);

  await prisma.guildSettings.upsert({
    where: { guildId },
    update: { ticketLogChannelId: nullable(str(formData, "ticketLogChannelId")) },
    create: { guildId, ticketLogChannelId: nullable(str(formData, "ticketLogChannelId")) },
  });

  refresh(guildId, "tickets");
}

export async function createTicketPanel(guildId: string, formData: FormData): Promise<void> {
  await requireGuildManager(guildId);

  const channelId = str(formData, "channelId");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const categoryId = nullable(str(formData, "categoryId"));
  const supportRoleId = nullable(str(formData, "supportRoleId"));
  const maxOpenPerUser = Math.max(1, num(formData, "maxOpenPerUser", 1));

  if (!channelId || !title) {
    throw new Error("A channel and a title are required.");
  }

  const panel = await prisma.ticketPanel.create({
    data: {
      guildId,
      channelId,
      messageId: "",
      title,
      description: description || null,
      categoryId,
      supportRoleId,
      maxOpenPerUser,
    },
  });

  const message = await createChannelMessage(channelId, {
    embeds: [
      {
        title,
        color: 0x6366f1,
        description: description || "Click the button below to open a support ticket.",
        footer: { text: WEBSITE_NAME },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: "Create ticket",
            emoji: { name: "🎫" },
            custom_id: `ticket:create:${panel.id}`,
          },
        ],
      },
    ],
  });

  await prisma.ticketPanel.update({ where: { id: panel.id }, data: { messageId: message.id } });

  refresh(guildId, "tickets");
}

export async function deleteTicketPanel(guildId: string, panelId: string): Promise<void> {
  await requireGuildManager(guildId);
  await prisma.ticketPanel.deleteMany({ where: { guildId, id: panelId } });
  refresh(guildId, "tickets");
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
