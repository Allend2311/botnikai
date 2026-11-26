import { z } from "zod";
import { classify, getLatestModel } from "@/lib/moderation-model";
import { isBotOwner } from "@/lib/owners";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

/** Owner-only playground for the currently stored classifier. */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ ok: false, error: "Sign in with Discord first." }, { status: 401 });
  }

  if (!(await isBotOwner(session.user.discordId))) {
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
      { ok: false, error: "Enter some text to classify (max 2000 characters)." },
      { status: 400 },
    );
  }

  try {
    const model = await getLatestModel();
    if (!model) {
      return Response.json(
        { ok: false, error: "Train a model first." },
        { status: 409 },
      );
    }

    return Response.json({
      ok: true,
      modelId: model.id,
      trainedAt: model.trainedAt,
      predictions: classify(parsed.data.text, model),
    });
  } catch (error) {
    console.error("[owner/model] classification failed:", error);
    return Response.json({ ok: false, error: "Could not classify that text." }, { status: 500 });
  }
}
