import type { Message } from "discord.js";
import { AUTOMOD_ACTIONS, type AutomodAction, type AutomodViolationKind } from "@guardbot/shared";
import { getCachedConfig, parseJsonArray } from "../lib/settings";

export interface AutomodViolation {
  kind: AutomodViolationKind;
  action: AutomodAction;
  reason: string;
  matched?: string;
}

const INVITE_PATTERN = /(?:discord(?:app)?\.com\/invite|discord\.gg|discord\.me|discordapp\.com\/invite|dsc\.gg)\/([\w-]{2,})/gi;
const LINK_PATTERN = /https?:\/\/[^\s<>"']+/gi;

/** Rolling message counter used for spam detection (per guild + member). */
const spamTracker = new Map<string, number[]>();

function resetTracker() {
  if (spamTracker.size > 5000) spamTracker.clear();
}

export function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return false;
  return allowedDomains.some((domain) => {
    const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!normalized) return false;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname === normalized || hostname.endsWith(`.${normalized}`);
    } catch {
      return false;
    }
  });
}

export async function checkMessage(message: Message): Promise<AutomodViolation | null> {
  if (message.author.bot || message.system || !message.guild) return null;

  const guildId = message.guild.id;
  const { automod } = await getCachedConfig(guildId);

  if (!automod.enabled) return null;

  const ignoreChannels = parseJsonArray(automod.ignoreChannels);
  if (ignoreChannels.includes(message.channelId)) return null;

  const ignoreRoles = parseJsonArray(automod.ignoreRoles);
  const memberRoleIds = message.member?.roles.cache.map((role) => role.id) ?? [];
  if (memberRoleIds.some((roleId) => ignoreRoles.includes(roleId))) return null;

  const content = message.content ?? "";

  if (automod.blockInvites) {
    INVITE_PATTERN.lastIndex = 0;
    const match = INVITE_PATTERN.exec(content);
    if (match) {
      return {
        kind: "INVITE",
        action: automod.actionLink as AutomodAction,
        reason: "Discord invite link detected",
        matched: match[0],
      };
    }
  }

  if (automod.blockExternalLinks) {
    const allowedDomains = parseJsonArray(automod.allowedDomains);
    LINK_PATTERN.lastIndex = 0;
    const links = content.match(LINK_PATTERN) ?? [];
    for (const link of links) {
      if (isAllowedDomain(link, allowedDomains)) continue;
      return {
        kind: "LINK",
        action: automod.actionLink as AutomodAction,
        reason: "External link blocked",
        matched: link,
      };
    }
  }

  const bannedWords = parseJsonArray(automod.bannedWords);
  const lowerContent = content.toLowerCase();
  for (const word of bannedWords) {
    const needle = word.trim().toLowerCase();
    if (!needle) continue;
    if (lowerContent.includes(needle)) {
      return {
        kind: "WORD",
        action: automod.actionWord as AutomodAction,
        reason: "Banned word used",
        matched: word,
      };
    }
  }

  if (automod.blockCaps) {
    const letters = content.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= 20) {
      const upperRatio = ((letters.match(/[A-Z]/g) ?? []).length / letters.length) * 100;
      if (upperRatio > automod.maxCapsPercent) {
        return {
          kind: "CAPS",
          action: automod.actionCaps as AutomodAction,
          reason: `Too many capital letters (${Math.round(upperRatio)}%)`,
        };
      }
    }
  }

  const now = Date.now();
  const key = `${guildId}:${message.author.id}`;
  const windowMs = Math.max(1, automod.spamWindowSeconds) * 1000;
  const timestamps = (spamTracker.get(key) ?? []).filter((time) => now - time < windowMs);
  timestamps.push(now);
  spamTracker.set(key, timestamps);
  resetTracker();

  if (timestamps.length > automod.spamMaxMessages) {
    return {
      kind: "SPAM",
      action: automod.actionSpam as AutomodAction,
      reason: `Spam detected (${timestamps.length} messages in ${automod.spamWindowSeconds}s)`,
    };
  }

  return null;
}

export function isKnownAction(action: string): action is AutomodAction {
  return (AUTOMOD_ACTIONS as readonly string[]).includes(action);
}
