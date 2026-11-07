import { DiscordApiError, discordRequest } from "@/lib/discord";
import { isBotOwner } from "@/lib/owners";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

interface BotProfile {
  id: string;
  username: string;
  avatar: string | null;
}

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return jsonError("Sign in with Discord first.", 401);
  if (!(await isBotOwner(session.user.discordId))) return jsonError("Not found.", 404);

  try {
    const profile = await discordRequest<BotProfile>("/users/@me");
    return Response.json({ ok: true, profile });
  } catch (error) {
    console.error("[owner/profile] could not load the bot profile:", error);
    return jsonError("Could not load the bot profile from Discord. Check the bot token and try again.", 502);
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return jsonError("Sign in with Discord first.", 401);
  if (!(await isBotOwner(session.user.discordId))) return jsonError("Not found.", 404);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return jsonError("Profile images must be smaller than 8 MB.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the form. Please try again.", 400);
  }

  const usernameValue = formData.get("username");
  const imageValue = formData.get("avatar");
  const username = typeof usernameValue === "string" ? usernameValue.trim() : "";

  if (username.length < 2 || username.length > 32) {
    return jsonError("Bot name must be between 2 and 32 characters.", 400);
  }
  if (imageValue !== null && !(imageValue instanceof File)) {
    return jsonError("Choose a valid profile image.", 400);
  }
  const image = imageValue instanceof File && imageValue.name ? imageValue : null;
  if (image instanceof File) {
    if (!IMAGE_TYPES.has(image.type)) {
      return jsonError("Choose a PNG, JPEG, WebP, or GIF image.", 415);
    }
    if (image.size === 0 || image.size > MAX_FILE_SIZE) {
      return jsonError("Profile images must be smaller than 8 MB.", 413);
    }
  }

  const body: { username: string; avatar?: string } = { username };
  if (image instanceof File) {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    body.avatar = `data:${image.type};base64,${base64}`;
  }

  try {
    const profile = await discordRequest<BotProfile>("/users/@me", {
      method: "PATCH",
      body,
    });
    return Response.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 429) {
      return jsonError("Discord is rate-limiting profile changes. Wait a little while, then try again.", 429);
    }
    if (error instanceof DiscordApiError && error.status === 400) {
      return jsonError("Discord rejected the name or image. Check them and try again.", 400);
    }

    console.error("[owner/profile] could not update the bot profile:", error);
    return jsonError("Discord could not update the bot profile. Please try again.", 502);
  }
}
