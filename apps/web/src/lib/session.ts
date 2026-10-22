import { cookies } from "next/headers";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "gb_session";
export const OAUTH_STATE_COOKIE = "gb_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Only mark cookies as secure when the site is actually served over https. */
export const useSecureCookies = (process.env.APP_URL ?? "").startsWith("https://");

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
