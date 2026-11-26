import { trainAndStoreModel } from "@/lib/moderation-model";
import { isBotOwner } from "@/lib/owners";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Owner-only on-demand training job. Non-owners get a plain 404. */
export async function POST(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Sign in with Discord first." }, { status: 401 });
  }

  if (!(await isBotOwner(session.user.discordId))) {
    return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  try {
    const result = await trainAndStoreModel(session.user.globalName ?? session.user.username);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[owner/model] training failed:", error);
    return Response.json(
      { ok: false, error: (error as Error).message || "Training failed. Please try again." },
      { status: 400 },
    );
  }
}
