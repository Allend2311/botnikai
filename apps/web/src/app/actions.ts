"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AUTOMOD_ACTIONS,
  LIVE_MODES,
  STREAM_PLATFORMS,
  type AutomodAction,
  type LiveMode,
} from "@guardbot/shared";
import { Prisma } from "@prisma/client";
import { WEBSITE_NAME } from "@/lib/brand";
import { requireGuildAdministrator, requireGuildManager } from "@/lib/auth";
import {
  addGuildMemberRole,
  createChannelMessage,
  getGuildChannels,
  getGuildRoles,
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

export async function approveRoleRequest(
  guildId: string,
  requestId: string,
  formData: FormData,
): Promise<void> {
  const { user } = await requireGuildAdministrator(guildId);
  const roleId = str(formData, "roleId");
  if (!roleId) {
    throw new Error("Select a role before approving this request.");
  }

  const roles = await getGuildRoles(guildId);
  const role = roles.find((candidate) => candidate.id === roleId);
  if (!role || role.id === guildId || role.managed) {
    throw new Error("Choose a valid, assignable role from this server.");
  }

  const request = await prisma.roleRequest.findFirst({
    where: { id: requestId, guildId, status: "PENDING_REVIEW" },
  });
  if (!request) {
    throw new Error("This role request is no longer waiting for review.");
  }

  const claim = await prisma.roleRequest.updateMany({
    where: { id: requestId, guildId, status: "PENDING_REVIEW" },
    data: { status: "APPROVING", roleId },
  });
  if (claim.count !== 1) {
    throw new Error("This role request is already being reviewed.");
  }

  try {
    await addGuildMemberRole(guildId, request.applicantId, roleId);
  } catch (error) {
    await prisma.roleRequest.updateMany({
      where: { id: requestId, guildId, status: "APPROVING" },
      data: { status: "PENDING_REVIEW" },
    });
    throw new Error(
      `Could not give the role. Check that the bot has Manage Roles and its highest role is above the requested role. ${
        error instanceof Error ? error.message : ""
      }`.trim(),
    );
  }

  await prisma.roleRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", decidedBy: user.discordId, decidedAt: new Date() },
  });
  refresh(guildId, "role-requests");
}

export async function denyRoleRequest(guildId: string, requestId: string): Promise<void> {
  const { user } = await requireGuildAdministrator(guildId);
  const result = await prisma.roleRequest.updateMany({
    where: { id: requestId, guildId, status: "PENDING_REVIEW" },
    data: { status: "DENIED", decidedBy: user.discordId, decidedAt: new Date() },
  });

  if (result.count !== 1) {
    throw new Error("This role request is no longer waiting for review.");
  }

  refresh(guildId, "role-requests");
}

export async function addLiveStreamAccount(guildId: string, formData: FormData): Promise<void> {
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
  await requireGuildManager(guildId);
  const result = await prisma.liveStreamAccount.deleteMany({ where: { id: accountId, guildId } });
  if (result.count !== 1) {
    throw new Error("This streaming account was not found.");
  }

  refresh(guildId, "notifications");
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
  await requireGuildManager(guildId);

  const mode = str(formData, "liveMode");
  const liveMode: LiveMode = (LIVE_MODES as readonly string[]).includes(mode)
    ? (mode as LiveMode)
    : "both";

  const data = {
    liveEnabled: bool(formData, "liveEnabled"),
    liveChannelId: nullable(str(formData, "liveChannelId")),
    liveRoleId: nullable(str(formData, "liveRoleId")),
    livePingUser: bool(formData, "livePingUser"),
    liveMode,
    liveAnnounceEnd: bool(formData, "liveAnnounceEnd"),
    liveIncludeUrl: bool(formData, "liveIncludeUrl"),
    postEnabled: bool(formData, "postEnabled"),
    postForumChannelId: nullable(str(formData, "postForumChannelId")),
    postWatchChannelId: nullable(str(formData, "postWatchChannelId")),
    postChannelId: nullable(str(formData, "postChannelId")),
    postRoleId: nullable(str(formData, "postRoleId")),
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

async function sendNotificationPingTest(
  guildId: string,
  kind: "live" | "post",
): Promise<void> {
  const { user } = await requireGuildManager(guildId);

  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  const channelId = kind === "live" ? settings?.liveChannelId : settings?.postChannelId;
  const roleId = kind === "live" ? settings?.liveRoleId : settings?.postRoleId;
  const pingUser =
    kind === "live"
      ? settings?.livePingUser
      : settings?.postPingAuthor;

  if (!channelId) {
    throw new Error(`Set the ${kind === "live" ? "live" : "post"} announcement channel before testing.`);
  }

  const [channels, roles] = await Promise.all([
    getGuildChannels(guildId),
    roleId ? getGuildRoles(guildId) : Promise.resolve([]),
  ]);
  const channel = channels.find(
    (candidate) =>
      candidate.id === channelId &&
      candidate.guild_id === guildId &&
      (candidate.type === 0 || candidate.type === 5),
  );
  if (!channel) {
    throw new Error("The configured announcement channel is unavailable or is not a text channel.");
  }

  if (roleId && !roles.some((role) => role.id === roleId)) {
    throw new Error("The configured ping role no longer exists. Update it in Notifications before testing.");
  }

  const isLive = kind === "live";
  const userMention = pingUser ? `<@${user.discordId}>` : "";
  const roleMention = roleId ? `<@&${roleId}>` : "";
  await createChannelMessage(channelId, {
    content: [roleMention, userMention].filter(Boolean).join(" ") || undefined,
    embeds: [
      {
        title: isLive ? "Test live announcement" : "Test post announcement",
        description: isLive
          ? "This is a test of the configured live announcement ping."
          : "This is a test of the configured new post announcement ping.",
        color: isLive ? 0xef4444 : 0x8b5cf6,
        footer: { text: "Configuration test — no real stream or post was detected." },
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: {
      parse: [],
      roles: roleId ? [roleId] : [],
      users: pingUser ? [user.discordId] : [],
    },
  });
}

export async function testLivePing(guildId: string): Promise<void> {
  await sendNotificationPingTest(guildId, "live");
}

export async function testPostPing(guildId: string): Promise<void> {
  await sendNotificationPingTest(guildId, "post");
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
