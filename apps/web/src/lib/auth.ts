import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, getSessionUser, SessionExpiredError, withAccessToken } from "./session";
import { canManageGuild, getUserGuilds, isGuildAdministrator } from "./discord";
import { isBotOwner } from "./owners";

/**
 * Returns the signed in user or redirects to the landing page.
 */
export const requireUser = cache(async () => {
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }

  return user;
});

/**
 * Makes sure the signed in user may manage the given guild.
 * Throws when the user has no permission (used by the server actions).
 */
export async function requireGuildManager(guildId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("You need to sign in with Discord first.");
  }

  const guilds = await loadGuilds(session);
  const guild = guilds.find((entry) => entry.id === guildId);

  if (!guild) {
    throw new Error("You are not a member of this server.");
  }

  if (!canManageGuild(guild.permissions)) {
    throw new Error("You need the Manage Server permission to change these settings.");
  }

  return { user: session.user, guild };
}

/**
 * Loads the guild list, refreshing the Discord token when it has expired.
 * A dead refresh token becomes a regular, user readable error so server
 * actions and route handlers can surface it instead of crashing.
 */
async function loadGuilds(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  try {
    return await withAccessToken(session, getUserGuilds);
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      throw new Error(error.message);
    }
    throw error;
  }
}

export async function requireGuildAdministrator(guildId: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("You need to sign in with Discord first.");
  }

  const guilds = await loadGuilds(session);
  const guild = guilds.find((entry) => entry.id === guildId);

  if (!guild) {
    throw new Error("You are not a member of this server.");
  }

  if (!isGuildAdministrator(guild.permissions)) {
    throw new Error("Only server Administrators can manage role requests.");
  }

  return { user: session.user, guild };
}

/**
 * Makes sure the signed in user is the bot owner. Used by features that are
 * still limited to the developer, such as the Notifications page.
 */
export async function requireBotOwner() {
  const session = await getSession();
  if (!session) {
    throw new Error("You need to sign in with Discord first.");
  }

  if (!(await isBotOwner(session.user.discordId))) {
    throw new Error("Notifications are coming soon and are not available yet.");
  }

  return session.user;
}
