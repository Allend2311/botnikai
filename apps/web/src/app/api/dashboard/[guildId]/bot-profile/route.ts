import { DiscordApiError, getBotUser, getGuildMember, setGuildMemberNickname } from "@/lib/discord";
import { requireGuildManager } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ guildId: string }> };

function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status });
}

async function authorize(guildId: string): Promise<Response | null> {
  try {
    await requireGuildManager(guildId);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify your server permissions.";
    const status = /Manage Server|not a member/i.test(message) ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const { guildId } = await params;
  const authorizationError = await authorize(guildId);
  if (authorizationError) return authorizationError;

  try {
    const botUser = await getBotUser();
    const member = await getGuildMember(guildId, botUser.id);
    if (!member) return jsonError("The bot is not in this server.", 404);
    return Response.json({ ok: true, nickname: member.nick });
  } catch (error) {
    console.error("[dashboard/bot-profile] could not load the bot nickname:", error);
    return jsonError("Could not load the bot's nickname from Discord.", 502);
  }
}

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  const { guildId } = await params;
  const authorizationError = await authorize(guildId);
  if (authorizationError) return authorizationError;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Could not read the form. Please try again.", 400);
  }

  const nicknameValue = formData.get("nickname");
  if (typeof nicknameValue !== "string") {
    return jsonError("Enter a bot nickname or leave it empty to restore the default.", 400);
  }
  const nickname = nicknameValue.trim();
  if (nickname.length > 32) {
    return jsonError("Bot nicknames cannot exceed 32 characters.", 400);
  }

  try {
    const botUser = await getBotUser();
    const savedNickname = nickname || null;
    await setGuildMemberNickname(guildId, botUser.id, savedNickname);
    return Response.json({ ok: true, nickname: savedNickname });
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 403) {
      return jsonError("The bot needs permission to change its nickname in this server.", 403);
    }
    if (error instanceof DiscordApiError && error.status === 404) {
      return jsonError("The bot is not in this server.", 404);
    }
    console.error("[dashboard/bot-profile] could not update the bot nickname:", error);
    return jsonError("Discord could not update the bot nickname. Please try again.", 502);
  }
}
