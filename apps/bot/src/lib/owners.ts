import { Team, type Client, type User } from "discord.js";
import { logger } from "./logger";

/**
 * The people who may run destructive, global commands such as `/broadcast`.
 *
 * `BOT_OWNER_IDS` is authoritative when it is set (comma separated Discord
 * user ids). The Discord application/team owner is used as a fallback so the
 * command still works without extra configuration.
 */

const APPLICATION_OWNER_TTL_MS = 10 * 60 * 1000;

interface CachedOwners {
  ids: Set<string>;
  expiresAt: number;
}

let applicationOwners: CachedOwners | null = null;

export function configuredOwnerIds(): string[] {
  return (process.env.BOT_OWNER_IDS ?? "")
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter((id) => /^\d{5,25}$/.test(id));
}

function collectOwnerId(owner: User | Team | null, into: Set<string>): void {
  if (!owner) return;

  if (owner instanceof Team) {
    for (const member of owner.members.values()) {
      if (member.user?.id) into.add(member.user.id);
    }
    if (owner.ownerId) into.add(owner.ownerId);
    return;
  }

  if ("id" in owner && owner.id) into.add(owner.id);
}

async function applicationOwnerIds(client: Client): Promise<Set<string>> {
  if (applicationOwners && applicationOwners.expiresAt > Date.now()) {
    return applicationOwners.ids;
  }

  const ids = new Set<string>();
  try {
    const application = client.application;
    if (application) {
      // `.owner` is populated on ready; refresh it in case the team changed.
      const fresh = await application.fetch().catch(() => application);
      collectOwnerId(fresh.owner ?? null, ids);
    }
  } catch (error) {
    logger.warn("owners", `Could not resolve the Discord application owner: ${(error as Error).message}`);
  }

  applicationOwners = { ids, expiresAt: Date.now() + APPLICATION_OWNER_TTL_MS };
  return ids;
}

export async function isBotOwner(client: Client, userId: string): Promise<boolean> {
  if (!userId) return false;
  if (configuredOwnerIds().includes(userId)) return true;

  const owners = await applicationOwnerIds(client);
  return owners.has(userId);
}

/** Test hooks. */
export function resetOwnerCache(): void {
  applicationOwners = null;
}
