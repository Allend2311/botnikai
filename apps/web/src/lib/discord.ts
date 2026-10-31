import { createHash } from "node:crypto";

/**
 * Minimal Discord REST helpers.
 *
 * The website only needs a handful of endpoints, so plain `fetch` is used
 * instead of pulling the whole discord.js client into the Next.js bundle.
 */

const API_BASE = "https://discord.com/api/v10";
const FALLBACK_APP_URL = "http://localhost:3000";
const USER_GUILD_CACHE_TTL_MS = 30_000;
const userGuildCache = new Map<
  string,
  { expiresAt: number; promise: Promise<DiscordGuild[]> }
>();

/**
 * Turns whatever was entered in the hosting dashboard into a clean origin.
 *
 * Hosting UIs make it very easy to save `https://site.netlify.app/` or
 * `site.netlify.app` instead of `https://site.netlify.app`. Discord compares the
 * redirect URL character by character, so the value is normalised before it is
 * used anywhere.
 */
export function normaliseAppUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

/**
 * Public origin of the website.
 *
 * `APP_URL` wins so the bot and the website always agree. When it is missing the
 * Netlify-provided deploy variables are used instead, followed by localhost.
 */
export function getAppUrl(): string {
  return (
    normaliseAppUrl(process.env.APP_URL) ??
    normaliseAppUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normaliseAppUrl(process.env.DEPLOY_PRIME_URL) ??
    normaliseAppUrl(process.env.URL) ??
    FALLBACK_APP_URL
  );
}

/** Same as `getAppUrl`, but falls back to the host the request arrived on (Netlify, proxies). */
export function getAppUrlForHeaders(headers: Headers): string {
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  const forwardedProto = headers.get("x-forwarded-proto") ?? "https";

  return (
    normaliseAppUrl(process.env.APP_URL) ??
    normaliseAppUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normaliseAppUrl(`${forwardedProto}://${forwardedHost}`) ??
    FALLBACK_APP_URL
  );
}

/** Convenience wrapper around `getAppUrlForHeaders` for a route handler request. */
export function getAppUrlForRequest(request: Request): string {
  return getAppUrlForHeaders(request.headers);
}

/** The exact URL that must be registered in the Discord Developer Portal. */
export function getOAuthRedirectUri(appUrl: string = getAppUrl()): string {
  return new URL("/api/auth/callback", appUrl).toString();
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  owner_id?: string | null;
  permissions: string;
  approximate_member_count?: number;
  /** Present on `GET /guilds/:id` (the server's "system messages" channel). */
  system_channel_id?: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  guild_id?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  color: number;
  permissions: string;
}

interface DiscordMessage {
  id: string;
  components: Array<{
    components?: Array<{ custom_id?: string }>;
  }>;
  embeds?: Array<{
    timestamp?: string;
    fields?: Array<{ name: string; value: string }>;
  }>;
}

export interface DiscordMember {
  user: DiscordUser;
  roles: string[];
  permissions: string;
  nick: string | null;
}

export class DiscordApiError extends Error {
  /** Discord's numeric error code (for example 50013 = Missing Permissions). */
  readonly code: number | null;

  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DiscordApiError";

    const match = message.match(/"code"\s*:\s*(-?\d+)/);
    this.code = match ? Number(match[1]) : null;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
  /** Use the "Bot" prefix (application token). */
  bot?: boolean;
}

export async function discordRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, body, bot = true } = options;

  const authorization = bot
    ? `Bot ${token ?? process.env.DISCORD_TOKEN ?? ""}`
    : `Bearer ${token ?? ""}`;

  const maxAttempts = method === "GET" ? 3 : 1;
  let response: Response | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    if (attempt === maxAttempts) break;

    if (response.status === 429 && method === "GET") {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryAfterBody = Number(
        (await response.clone().json().catch(() => null))?.retry_after,
      );
      const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader
        : retryAfterBody;

      if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0 || retryAfterSeconds > 5) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.ceil(retryAfterSeconds * 1000)));
      continue;
    }

    if (response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 300));
  }

  if (!response) {
    throw new Error("Discord API request did not produce a response.");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new DiscordApiError(response.status, `Discord API ${response.status} for ${method} ${path}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// OAuth2
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(
  state: string,
  redirectUri: string = getOAuthRedirectUri(),
): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "identify guilds guilds.members.read",
    state,
    prompt: "consent",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string = getOAuthRedirectUri(),
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new DiscordApiError(
      response.status,
      `Discord OAuth token exchange failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
}

/**
 * Exchanges a refresh token for a new access token.
 *
 * Discord access tokens only live for about seven days, so a long lived website
 * session has to refresh them or every Discord call starts returning 401.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new DiscordApiError(
      response.status,
      `Discord OAuth token refresh failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
}

export async function getCurrentUser(accessToken: string): Promise<DiscordUser> {
  return discordRequest<DiscordUser>("/users/@me", { token: accessToken, bot: false });
}

export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const now = Date.now();
  for (const [key, entry] of userGuildCache) {
    if (entry.expiresAt <= now) userGuildCache.delete(key);
  }

  const cacheKey = createHash("sha256").update(accessToken).digest("hex");
  const cached = userGuildCache.get(cacheKey);
  if (cached) return cached.promise;

  const entry = {
    expiresAt: now + USER_GUILD_CACHE_TTL_MS,
    promise: discordRequest<DiscordGuild[]>("/users/@me/guilds", {
      token: accessToken,
      bot: false,
    }),
  };
  userGuildCache.set(cacheKey, entry);

  try {
    const guilds = await entry.promise;
    entry.expiresAt = Date.now() + USER_GUILD_CACHE_TTL_MS;
    return guilds;
  } catch (error) {
    if (userGuildCache.get(cacheKey) === entry) userGuildCache.delete(cacheKey);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Bot endpoints
// ---------------------------------------------------------------------------

export async function getBotGuild(guildId: string): Promise<DiscordGuild | null> {
  try {
    return await discordRequest<DiscordGuild>(`/guilds/${guildId}`);
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 404) return null;
    throw error;
  }
}

/** Every server the bot is currently installed in (application/bot token). */
export async function getBotGuilds(): Promise<DiscordGuild[]> {
  return discordRequest<DiscordGuild[]>("/users/@me/guilds");
}

export async function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  return discordRequest<DiscordChannel[]>(`/guilds/${guildId}/channels`);
}

export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  return discordRequest<DiscordRole[]>(`/guilds/${guildId}/roles`);
}

/** The bot's own Discord user, cached for the lifetime of the server process. */
let botUserPromise: Promise<DiscordUser> | null = null;
export function getBotUser(): Promise<DiscordUser> {
  botUserPromise ??= discordRequest<DiscordUser>("/users/@me").catch((error) => {
    botUserPromise = null;
    throw error;
  });
  return botUserPromise;
}

export async function getGuildMember(
  guildId: string,
  userId: string,
): Promise<DiscordMember | null> {
  try {
    return await discordRequest<DiscordMember>(`/guilds/${guildId}/members/${userId}`);
  } catch (error) {
    if (error instanceof DiscordApiError && (error.status === 404 || error.code === 10007)) {
      return null;
    }
    throw error;
  }
}

/**
 * What the bot is allowed to do with roles in one server.
 *
 * Discord checks two things when a bot assigns a role: the bot needs
 * `Manage Roles`, and the role must sit below the bot's own highest role.
 * `Administrator` does not bypass the hierarchy check.
 */
export interface RoleAssignmentCapabilities {
  isMember: boolean;
  hasManageRoles: boolean;
  hasManageNicknames: boolean;
  hasAdministrator: boolean;
  highestRoleName: string;
  highestRolePosition: number;
  ownerId: string | null;
  /** Set when the bot cannot assign any role at all. */
  reason: string | null;
}

export async function getRoleAssignmentCapabilities(
  guildId: string,
  knownRoles?: DiscordRole[],
): Promise<RoleAssignmentCapabilities> {
  const [botUser, roles, guild] = await Promise.all([
    getBotUser(),
    knownRoles ? Promise.resolve(knownRoles) : getGuildRoles(guildId),
    getBotGuild(guildId),
  ]);
  const member = guild ? await getGuildMember(guildId, botUser.id) : null;

  if (!member || !guild) {
    return {
      isMember: false,
      hasManageRoles: false,
      hasManageNicknames: false,
      hasAdministrator: false,
      highestRoleName: "—",
      highestRolePosition: 0,
      ownerId: guild?.owner_id ?? null,
      reason: "The bot is not a member of this server, so it cannot assign roles.",
    };
  }

  let permissions = BigInt(roles.find((role) => role.id === guildId)?.permissions ?? "0");
  let highest = { name: "@everyone", position: 0 };

  for (const role of roles) {
    if (!member.roles.includes(role.id)) continue;
    permissions |= BigInt(role.permissions ?? "0");
    if (role.position > highest.position) {
      highest = { name: role.name, position: role.position };
    }
  }

  const hasAdministrator =
    (permissions & PERMISSION_FLAGS.ADMINISTRATOR) === PERMISSION_FLAGS.ADMINISTRATOR;
  const hasManageRoles =
    (permissions & PERMISSION_FLAGS.MANAGE_ROLES) === PERMISSION_FLAGS.MANAGE_ROLES;
  const hasManageNicknames =
    (permissions & PERMISSION_FLAGS.MANAGE_NICKNAMES) === PERMISSION_FLAGS.MANAGE_NICKNAMES;

  return {
    isMember: true,
    hasManageRoles,
    hasManageNicknames,
    hasAdministrator,
    highestRoleName: highest.name,
    highestRolePosition: highest.position,
    ownerId: guild.owner_id ?? null,
    reason:
      hasAdministrator || hasManageRoles
        ? null
        : "The bot needs the Manage Roles permission in this server before it can assign roles.",
  };
}

/**
 * Highest role of a member. Discord only lets the bot change a nickname when
 * the bot's own highest role is strictly higher than this role.
 */
export async function getMemberHighestRole(
  guildId: string,
  userId: string,
  knownRoles?: DiscordRole[],
): Promise<{ name: string; position: number } | null> {
  const [member, roles] = await Promise.all([
    getGuildMember(guildId, userId),
    knownRoles ? Promise.resolve(knownRoles) : getGuildRoles(guildId),
  ]);
  if (!member) return null;

  let highest = { name: "@everyone", position: 0 };
  for (const role of roles) {
    if (member.roles.includes(role.id) && role.position > highest.position) {
      highest = { name: role.name, position: role.position };
    }
  }
  return highest;
}

/**
 * Returns a human readable reason when the bot cannot assign `role`, or `null`
 * when the assignment should be accepted by Discord.
 */
export function roleAssignmentBlocker(
  role: DiscordRole,
  capabilities: RoleAssignmentCapabilities,
  guildId: string,
): string | null {
  if (role.id === guildId) {
    return "The @everyone role cannot be assigned.";
  }
  if (role.managed) {
    return `“${role.name}” is managed by an integration and cannot be assigned by the bot.`;
  }
  if (capabilities.reason) {
    return capabilities.reason;
  }
  if (role.position >= capabilities.highestRolePosition) {
    return `The bot's own role “${capabilities.highestRoleName}” sits below “${role.name}” in the role list. Drag “${capabilities.highestRoleName}” above “${role.name}” in Server Settings → Roles, then try again.`;
  }
  return null;
}

export async function createChannelMessage(
  channelId: string,
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  return discordRequest<{ id: string }>(`/channels/${channelId}/messages`, {
    method: "POST",
    body: payload,
  });
}

export async function editChannelMessage(
  channelId: string,
  messageId: string,
  payload: Record<string, unknown>,
): Promise<{ id: string; components?: unknown[] }> {
  return discordRequest<{ id: string; components?: unknown[] }>(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function findRoleRequestMessages(
  channelId: string,
  request: { id: string; applicantId: string; inGameName: string; voucherId: string; createdAt: Date },
): Promise<string[]> {
  const messages = await discordRequest<DiscordMessage[]>(
    `/channels/${channelId}/messages?limit=100`,
  );
  const targetIds = new Set([
    `role-vouch:approve:${request.id}`,
    `role-vouch:deny:${request.id}`,
    `role-review:approve:${request.id}`,
    `role-review:deny:${request.id}`,
  ]);

  return messages
    .filter((message) => {
      const hasRequestButton = (message.components ?? []).some((row) =>
        row.components?.some((component) => component.custom_id && targetIds.has(component.custom_id)),
      );
      const fields = message.embeds?.flatMap((embed) => embed.fields ?? []) ?? [];
      const hasMatchingApplication =
        message.embeds?.some((embed) => Date.parse(embed.timestamp ?? "") === request.createdAt.getTime()) &&
        fields.some((field) => field.name.toLowerCase() === "applicant" && field.value.includes(request.applicantId)) &&
        fields.some((field) => field.name.toLowerCase() === "in-game name" && field.value === request.inGameName) &&
        fields.some((field) => field.name.toLowerCase() === "vouched by" && field.value.includes(request.voucherId));

      return hasRequestButton || hasMatchingApplication;
    })
    .map((message) => message.id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const CHANNEL_TYPE = {
  GUILD_TEXT: 0,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
} as const;

export function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const extension = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${extension}?size=128`;
}

export function avatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  const extension = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=128`;
}

export const PERMISSION_FLAGS = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_MESSAGES: 1n << 13n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MODERATE_MEMBERS: 1n << 40n,
} as const;

export function hasPermission(permissions: string | bigint, permission: bigint): boolean {
  try {
    const bits = BigInt(permissions);
    return (bits & permission) === permission;
  } catch {
    return false;
  }
}

export function canManageGuild(permissions: string | bigint): boolean {
  return (
    hasPermission(permissions, PERMISSION_FLAGS.ADMINISTRATOR) ||
    hasPermission(permissions, PERMISSION_FLAGS.MANAGE_GUILD)
  );
}

export function isGuildAdministrator(permissions: string | bigint): boolean {
  return hasPermission(permissions, PERMISSION_FLAGS.ADMINISTRATOR);
}

export async function addGuildMemberRole(
  guildId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  await discordRequest<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
  });
}

export async function setGuildMemberNickname(
  guildId: string,
  userId: string,
  nickname: string,
): Promise<void> {
  await discordRequest<void>(`/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    body: { nick: nickname },
  });
}

/** Permissions the bot asks for when it is invited to a server. */
export const BOT_INVITE_PERMISSIONS =
  0n |
  PERMISSION_FLAGS.CREATE_INSTANT_INVITE |
  PERMISSION_FLAGS.KICK_MEMBERS |
  PERMISSION_FLAGS.BAN_MEMBERS |
  PERMISSION_FLAGS.MANAGE_CHANNELS |
  PERMISSION_FLAGS.MANAGE_GUILD |
  PERMISSION_FLAGS.MANAGE_MESSAGES |
  PERMISSION_FLAGS.MANAGE_ROLES |
  PERMISSION_FLAGS.MODERATE_MEMBERS |
  (1n << 10n) | // ManageWebhooks
  (1n << 11n) | // ManageEmojisAndStickers
  (1n << 16n) | // AttachFiles
  (1n << 7n) | // ViewChannel
  (1n << 8n) | // SendMessages
  (1n << 9n) | // SendMessagesInThreads
  (1n << 14n) | // EmbedLinks
  (1n << 17n) | // ReadMessageHistory
  (1n << 18n) | // MentionEveryone
  (1n << 20n) | // UseSlashCommands
  (1n << 26n) | // ChangeNickname
  (1n << 27n) | // ManageNicknames
  (1n << 31n) | // UseExternalEmojis
  (1n << 32n) | // ViewGuildInsights
  (1n << 35n) | // UseExternalApps
  (1n << 39n); // UseSoundboard

/**
 * Invite link for the bot.
 *
 * Without `guildId` Discord shows the server picker, so the bot can be added to
 * any server the visitor administers. With `guildId` the picker is skipped and
 * that one server is preselected (used by the dashboard cards).
 */
export function inviteUrl(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    permissions: BOT_INVITE_PERMISSIONS.toString(),
    scope: "bot applications.commands",
  });

  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
