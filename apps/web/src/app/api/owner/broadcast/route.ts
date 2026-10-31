import { z } from "zod";
import { BROADCAST_MESSAGE_MAX, BROADCAST_TITLE_MAX, toHttpsUrl } from "@guardbot/shared";
import { BroadcastError, sendBroadcastToGuild } from "@/lib/broadcast";
import { isBotOwner } from "@/lib/owners";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  guildId: z.string().regex(/^\d{5,25}$/, "Invalid server id."),
  title: z.string().trim().min(1).max(BROADCAST_TITLE_MAX).optional(),
  message: z.string().trim().min(1).max(BROADCAST_MESSAGE_MAX),
  imageUrl: z.string().trim().max(2048).optional().nullable(),
});

/**
 * Sends an owner broadcast to a single server.
 *
 * The client loops over the servers one request at a time so progress can be
 * shown and serverless function timeouts are not hit by a 45 server loop.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Sign in with Discord first." }, { status: 401 });
  }

  if (!(await isBotOwner(session.user.discordId))) {
    // Hide the endpoint entirely from non-owners.
    return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read the request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Check the update text and try again." },
      { status: 400 },
    );
  }

  const rawImage = parsed.data.imageUrl?.trim() || null;
  const imageUrl = rawImage ? toHttpsUrl(rawImage) : null;
  if (rawImage && !imageUrl) {
    return Response.json(
      { ok: false, error: "The image URL must be a public HTTPS URL." },
      { status: 400 },
    );
  }

  try {
    const result = await sendBroadcastToGuild(parsed.data.guildId, {
      title: parsed.data.title?.trim() || "Bot update",
      message: parsed.data.message,
      imageUrl,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BroadcastError) {
      return Response.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error("[broadcast] send failed:", error);
    return Response.json(
      { ok: false, error: "Discord did not accept the message. Please try again." },
      { status: 502 },
    );
  }
}
