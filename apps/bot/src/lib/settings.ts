import { Prisma, type AutomodConfig, type GuildSettings } from "@prisma/client";
import { prisma } from "./db";

/** Reads a JSON array column, tolerating malformed values. */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function ensureGuild(guildId: string, name: string, ownerId: string, icon?: string | null, memberCount = 0): Promise<void> {
  await prisma.guild.upsert({
    where: { id: guildId },
    update: { name, ownerId, icon: icon ?? null, memberCount },
    create: { id: guildId, name, ownerId, icon: icon ?? null, memberCount },
  });
}

export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const existing = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (existing) return existing;

  try {
    return await prisma.guildSettings.create({ data: { guildId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const createdByConcurrentRequest = await prisma.guildSettings.findUnique({ where: { guildId } });
      if (createdByConcurrentRequest) return createdByConcurrentRequest;
    }
    throw error;
  }
}

export async function getAutomodConfig(guildId: string): Promise<AutomodConfig> {
  const existing = await prisma.automodConfig.findUnique({ where: { guildId } });
  if (existing) return existing;

  try {
    return await prisma.automodConfig.create({ data: { guildId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const createdByConcurrentRequest = await prisma.automodConfig.findUnique({ where: { guildId } });
      if (createdByConcurrentRequest) return createdByConcurrentRequest;
    }
    throw error;
  }
}

/** Small in-memory cache so hot paths do not hit the database every message. */
const settingsCache = new Map<string, { settings: GuildSettings; automod: AutomodConfig; expires: number }>();
const CACHE_TTL = 5_000;

export async function getCachedConfig(guildId: string) {
  const cached = settingsCache.get(guildId);
  if (cached && cached.expires > Date.now()) {
    return cached;
  }

  const [settings, automod] = await Promise.all([getGuildSettings(guildId), getAutomodConfig(guildId)]);
  const entry = { settings, automod, expires: Date.now() + CACHE_TTL };
  settingsCache.set(guildId, entry);
  return entry;
}

export function invalidateConfigCache(guildId: string): void {
  settingsCache.delete(guildId);
}
