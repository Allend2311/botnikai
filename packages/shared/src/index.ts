/**
 * Shared contracts between the Discord bot and the web dashboard.
 * Everything here must stay dependency free so both runtimes can consume it.
 */

export const APP_NAME = "GuardBot";
export const APP_TAGLINE = "Moderation, tickets and live announcements for your Discord server.";
export const APP_DESCRIPTION =
  "GuardBot keeps your server safe with moderation, auto-mod, welcome roles, a ticket system, and instant notifications when a member goes live or publishes a new post.";

export const DISCORD_API = "https://discord.com/api/v10";

// ---------------------------------------------------------------------------
// Case types
// ---------------------------------------------------------------------------

export const CASE_TYPES = [
  "BAN",
  "UNBAN",
  "KICK",
  "MUTE",
  "UNMUTE",
  "WARN",
  "UNWARN",
  "PURGE",
  "SLOWMODE",
  "LOCK",
  "UNLOCK",
  "TICKET",
  "AUTOMOD",
] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_LABELS: Record<CaseType, string> = {
  BAN: "Ban",
  UNBAN: "Unban",
  KICK: "Kick",
  MUTE: "Timeout",
  UNMUTE: "Unmute",
  WARN: "Warning",
  UNWARN: "Warning removed",
  PURGE: "Purge",
  SLOWMODE: "Slowmode",
  LOCK: "Channel lock",
  UNLOCK: "Channel unlock",
  TICKET: "Ticket",
  AUTOMOD: "Auto-mod",
};

export const CASE_COLORS: Record<CaseType, number> = {
  BAN: 0xef4444,
  UNBAN: 0x22c55e,
  KICK: 0xf97316,
  MUTE: 0xf59e0b,
  UNMUTE: 0x22c55e,
  WARN: 0xf59e0b,
  UNWARN: 0x22c55e,
  PURGE: 0x64748b,
  SLOWMODE: 0x3b82f6,
  LOCK: 0xef4444,
  UNLOCK: 0x22c55e,
  TICKET: 0x6366f1,
  AUTOMOD: 0xa855f7,
};

export function isCaseType(value: string): value is CaseType {
  return (CASE_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Auto-mod
// ---------------------------------------------------------------------------

export const AUTOMOD_ACTIONS = ["DELETE", "WARN", "TIMEOUT", "KICK"] as const;
export type AutomodAction = (typeof AUTOMOD_ACTIONS)[number];

export const AUTOMOD_ACTION_LABELS: Record<AutomodAction, string> = {
  DELETE: "Delete message",
  WARN: "Warn member",
  TIMEOUT: "Timeout member",
  KICK: "Kick member",
};

export const AUTOMOD_VIOLATIONS = ["INVITE", "LINK", "SPAM", "CAPS", "WORD"] as const;
export type AutomodViolationKind = (typeof AUTOMOD_VIOLATIONS)[number];

export function isAutomodAction(value: string): value is AutomodAction {
  return (AUTOMOD_ACTIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export const TICKET_STATUS = ["OPEN", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
};

// ---------------------------------------------------------------------------
// Role request streaming profiles
// ---------------------------------------------------------------------------

export const STREAM_PLATFORMS = [
  "Kick",
  "TikTok",
] as const;

export type StreamPlatform = (typeof STREAM_PLATFORMS)[number];

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

export const TEMPLATE_TOKENS = [
  { token: "{user}", description: "Mention of the member" },
  { token: "{username}", description: "Username of the member" },
  { token: "{userid}", description: "User id of the member" },
  { token: "{server}", description: "Name of the server" },
  { token: "{membercount}", description: "Current member count" },
  { token: "{usercount}", description: "Number of members" },
] as const;

export function applyTemplate(
  template: string,
  values: {
    user?: string;
    username?: string;
    userid?: string;
    server?: string;
    membercount?: number;
  },
): string {
  return template
    .replaceAll("{user}", values.user ?? "there")
    .replaceAll("{username}", values.username ?? "member")
    .replaceAll("{userid}", values.userid ?? "")
    .replaceAll("{server}", values.server ?? "this server")
    .replaceAll("{membercount}", String(values.membercount ?? 0))
    .replaceAll("{usercount}", String(values.membercount ?? 0));
}

// ---------------------------------------------------------------------------
// Owner broadcasts
// ---------------------------------------------------------------------------

export const BROADCAST_TITLE_MAX = 200;
export const BROADCAST_MESSAGE_MAX = 1800;
export const BROADCAST_FOOTER = "GuardBot update";

/** Discord channel types that can receive an announcement embed. */
export const BROADCAST_TEXT_CHANNEL_TYPES = [0, 5] as const;

export interface BroadcastChannelInfo {
  id: string;
  name: string;
  type: number;
}

export interface BroadcastGuildInfo {
  systemChannelId?: string | null;
  channels: BroadcastChannelInfo[];
}

const BROADCAST_NAME_HINTS = [
  "announcement",
  "announce",
  "news",
  "updates",
  "update",
  "changelog",
  "patch",
  "bot-update",
];

function broadcastNameScore(name: string): number {
  const normalized = name.toLowerCase();
  let score = 0;
  for (const hint of BROADCAST_NAME_HINTS) {
    if (normalized.includes(hint)) score = Math.max(score, hint.length);
  }
  return score;
}

/**
 * Picks the channel a bot update should be posted in for a guild.
 *
 * Priority:
 *  1. the Discord "system messages" channel, when it is a text channel
 *  2. any announcement (news) channel, preferring a descriptive name
 *  3. a text channel whose name looks like an update channel
 *
 * Returns `null` when the guild has no obvious update destination, so the
 * caller can skip it instead of posting in a random channel.
 */
export function pickBroadcastChannel(guild: BroadcastGuildInfo): BroadcastChannelInfo | null {
  const usable = guild.channels.filter((channel) =>
    (BROADCAST_TEXT_CHANNEL_TYPES as readonly number[]).includes(channel.type),
  );
  if (usable.length === 0) return null;

  if (guild.systemChannelId) {
    const systemChannel = usable.find((channel) => channel.id === guild.systemChannelId);
    if (systemChannel) return systemChannel;
  }

  const byName = (channels: BroadcastChannelInfo[]): BroadcastChannelInfo[] =>
    [...channels].sort((a, b) => {
      const difference = broadcastNameScore(b.name) - broadcastNameScore(a.name);
      return difference !== 0 ? difference : a.name.localeCompare(b.name);
    });

  const announcements = usable.filter((channel) => channel.type === 5);
  if (announcements.length > 0) return byName(announcements)[0] ?? null;

  const named = byName(usable.filter((channel) => broadcastNameScore(channel.name) > 0));
  return named[0] ?? null;
}

/** Returns a normalised URL when the value is a public HTTPS URL, otherwise null. */
export function toHttpsUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function truncate(text: string, max = 200): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function relativeTime(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const diff = value.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/** Discord ids are snowflakes - they are safe to use as integers inside BigInt. */
export function toSnowflakeInt(id: string): bigint {
  try {
    return BigInt(id);
  } catch {
    return 0n;
  }
}
