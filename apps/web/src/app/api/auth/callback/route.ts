import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeCode, getCurrentUser } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { createSession, OAUTH_STATE_COOKIE } from "@/lib/session";

export async function GET(request: Request): Promise<never> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const store = await cookies();
  const storedState = store.get(OAUTH_STATE_COOKIE)?.value;

  if (oauthError) {
    store.delete(OAUTH_STATE_COOKIE);
    redirect("/?error=oauth_denied");
  }

  if (!code || !state || !storedState || state !== storedState) {
    redirect("/?error=oauth_state");
  }

  store.delete(OAUTH_STATE_COOKIE);

  try {
    const token = await exchangeCode(code);
    const profile = await getCurrentUser(token.access_token);

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
    console.error("[auth] OAuth callback failed:", error);
    redirect("/?error=oauth_failed");
  }

  redirect("/dashboard");
}
