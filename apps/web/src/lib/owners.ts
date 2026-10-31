import { discordRequest } from "./discord";

/**
 * Owner identity for the website.
 *
 * `BOT_OWNER_IDS` (comma or space separated Discord user ids) is authoritative.
 * When it is empty the Discord application owner / team members are used, so
 * the owner pages still work without extra configuration.
 */

const APPLICATION_OWNER_TTL_MS = 10 * 60 * 1000;

interface ApplicationInfo {
  owner?: { id?: string } | null;
  team?: {
    owner_id?: string;
    members?: Array<{ user?: { id?: string } }>;
  } | null;
}

let ownerCache: { ids: Set<string>; expiresAt: number } | null = null;

export function configuredOwnerIds(): string[] {
  return (process.env.BOT_OWNER_IDS ?? "")
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter((id) => /^\d{5,25}$/.test(id));
}

async function applicationOwnerIds(): Promise<Set<string>> {
  if (ownerCache && ownerCache.expiresAt > Date.now()) return ownerCache.ids;

  const ids = new Set<string>();
  try {
    const application = await discordRequest<ApplicationInfo>("/oauth2/applications/@me");
    if (application.owner?.id) ids.add(application.owner.id);
    if (application.team?.owner_id) ids.add(application.team.owner_id);
    for (const member of application.team?.members ?? []) {
      if (member.user?.id) ids.add(member.user.id);
    }
  } catch (error) {
    console.error("[owners] could not resolve the Discord application owner:", error);
  }

  ownerCache = { ids, expiresAt: Date.now() + APPLICATION_OWNER_TTL_MS };
  return ids;
}

export async function isBotOwner(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (configuredOwnerIds().includes(userId)) return true;

  const owners = await applicationOwnerIds();
  return owners.has(userId);
}
