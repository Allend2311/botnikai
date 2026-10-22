import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildAuthorizeUrl } from "@/lib/discord";
import { OAUTH_STATE_COOKIE, useSecureCookies } from "@/lib/session";

export async function GET(): Promise<never> {
  const state = crypto.randomUUID();

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge: 600,
  });

  redirect(buildAuthorizeUrl(state));
}
