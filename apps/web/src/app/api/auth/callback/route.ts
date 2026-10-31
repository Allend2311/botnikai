import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  exchangeCode,
  getAppUrlForRequest,
  getCurrentUser,
  getOAuthRedirectUri,
} from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
} from "@/lib/session";

/**
 * Sends the visitor back to the landing page with a short, non-sensitive error
 * code. The real error is only written to the server logs.
 */
function fail(reason: string): never {
  redirect(`/?error=oauth_failed&reason=${encodeURIComponent(reason)}`);
}

export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const storedState = store.get(OAUTH_STATE_COOKIE)?.value;
  const storedRedirectUri = store.get(OAUTH_REDIRECT_COOKIE)?.value;

  store.delete(OAUTH_STATE_COOKIE);
  store.delete(OAUTH_REDIRECT_COOKIE);

  if (oauthError) {
    redirect("/?error=oauth_denied");
  }

  if (!code || !state || !storedState || state !== storedState) {
    redirect("/?error=oauth_state");
  }

  // Prefer the URL captured at login time; fall back to the configured origin
  // so older in-flight logins still complete.
  const redirectUri =
    storedRedirectUri ?? getOAuthRedirectUri(getAppUrlForRequest(request));

  let token: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    token = await exchangeCode(code, redirectUri);
  } catch (error) {
    console.error("[auth] Discord token exchange failed:", error);
    fail("token_exchange");
  }

  let profile: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    profile = await getCurrentUser(token.access_token);
  } catch (error) {
    console.error("[auth] Could not load the Discord profile:", error);
    fail("profile");
  }

  try {
    const user = await prisma.user.upsert({
      where: { discordId: profile.id },
      update: {
        username: profile.username,
        globalName: profile.global_name,
        avatar: profile.avatar,
      },
      create: {
        discordId: profile.id,
        username: profile.username,
        globalName: profile.global_name,
        avatar: profile.avatar,
      },
    });

    await createSession({
      userId: user.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
    });
  } catch (error) {
    console.error("[auth] Could not create the session:", error);
    fail("session");
  }

  redirect("/dashboard");
}
