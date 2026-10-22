/**
 * Minimal Discord REST helpers.
 *
 * The website only needs a handful of endpoints, so plain `fetch` is used
 * instead of pulling the whole discord.js client into the Next.js bundle.
 */

const API_BASE = "https://discord.com/api/v10";

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
  permissions: string;
  approximate_member_count?: number;
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
}

export interface DiscordMember {
  user: DiscordUser;
  roles: string[];
  permissions: string;
  nick: string | null;
}

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DiscordApiError";
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

    if (response.status < 500 || attempt === maxAttempts) break;
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

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/callback`,
    scope: "identify guilds guilds.members.read",
    state,
    prompt: "consent",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<{
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
    redirect_uri: `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/callback`,
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

export async function getCurrentUser(accessToken: string): Promise<DiscordUser> {
  return discordRequest<DiscordUser>("/users/@me", { token: accessToken, bot: false });
}

export async function getUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  return discordRequest<DiscordGuild[]>("/users/@me/guilds", { token: accessToken, bot: false });
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

export async function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  return discordRequest<DiscordChannel[]>(`/guilds/${guildId}/channels`);
}

export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  return discordRequest<DiscordRole[]>(`/guilds/${guildId}/roles`);
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
): Promise<{ id: string }> {
  return discordRequest<{ id: string }>(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: payload,
  });
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
  (1n << 31n) | // UseExternalEmojis
  (1n << 32n) | // ViewGuildInsights
  (1n << 35n) | // UseExternalApps
  (1n << 39n); // UseSoundboard

export function inviteUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    permissions: BOT_INVITE_PERMISSIONS.toString(),
    scope: "bot applications.commands",
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}
