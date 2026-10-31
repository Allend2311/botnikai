import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildAuthorizeUrl,
  getAppUrlForRequest,
  getOAuthRedirectUri,
} from "@/lib/discord";
import {
  OAUTH_REDIRECT_COOKIE,
  OAUTH_STATE_COOKIE,
  useSecureCookies,
} from "@/lib/session";

export async function GET(request: Request): Promise<never> {
  const state = crypto.randomUUID();
  const redirectUri = getOAuthRedirectUri(getAppUrlForRequest(request));

  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies,
    path: "/",
    maxAge: 600,
  } as const;

  store.set(OAUTH_STATE_COOKIE, state, cookieOptions);
  // Remember the exact URL used for the authorize request. Discord requires the
  // token exchange to send a byte-for-byte identical `redirect_uri`.
  store.set(OAUTH_REDIRECT_COOKIE, redirectUri, cookieOptions);

  redirect(buildAuthorizeUrl(state, redirectUri));
}
