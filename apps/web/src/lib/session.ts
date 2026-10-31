import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { DiscordApiError, getAppUrl, refreshAccessToken } from "./discord";

export const SESSION_COOKIE = "gb_session";
export const OAUTH_STATE_COOKIE = "gb_oauth_state";
export const OAUTH_REDIRECT_COOKIE = "gb_oauth_redirect";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Raised when Discord rejects both the access token and the refresh token. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your Discord session expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

interface SessionTokens {
  id: string;
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Concurrent refreshes would rotate the refresh token twice and invalidate the
 * session, so refreshes are de-duplicated per session id.
 */
const refreshInFlight = new Map<string, Promise<string>>();

async function refreshSessionAccessToken(session: SessionTokens): Promise<string> {
  const inFlight = refreshInFlight.get(session.id);
  if (inFlight) return inFlight;

  const promise = (async () => {
    // Another request may have refreshed while this one was waiting.
    const current = await prisma.session.findUnique({ where: { id: session.id } });
    if (!current) throw new SessionExpiredError();
    if (current.accessToken !== session.accessToken) return current.accessToken;

    if (!current.refreshToken) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new SessionExpiredError();
    }

    let token: Awaited<ReturnType<typeof refreshAccessToken>>;
    try {
      token = await refreshAccessToken(current.refreshToken);
    } catch (error) {
      console.error("[auth] Discord token refresh failed:", error);
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new SessionExpiredError();
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token ?? current.refreshToken,
      },
    });

    return token.access_token;
  })();

  refreshInFlight.set(session.id, promise);
  try {
    return await promise;
  } finally {
    refreshInFlight.delete(session.id);
  }
}

/**
 * Runs a Discord call with the session token and transparently refreshes the
 * token once when Discord answers 401 (expired access token).
 */
export async function withAccessToken<T>(
  session: SessionTokens,
  run: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await run(session.accessToken);
  } catch (error) {
    if (!(error instanceof DiscordApiError) || error.status !== 401) throw error;

    const accessToken = await refreshSessionAccessToken(session);
    return run(accessToken);
  }
}

/** Only mark cookies as secure when the site is actually served over https. */
export const useSecureCookies = getAppUrl().startsWith("https://");

export async function createSession(params: {
  userId: string;
  accessToken: string;
  refreshToken?: string | null;
}): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    expires: expiresAt,
  });

  return session.id;
}

export async function getSession() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }

  return session;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;

  if (id) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
  }

  store.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const session = await getSession();
  return session?.user ?? null;
}
