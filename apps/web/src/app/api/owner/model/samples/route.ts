import { z } from "zod";
import { LABELS } from "@/lib/moderation-model";
import { isBotOwner } from "@/lib/owners";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content: z.string().trim().min(1).max(2000),
  label: z.enum(LABELS),
});

/** Owner-only: add a labelled message to the training set. */
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
      { ok: false, error: "Enter some text and choose a valid label." },
      { status: 400 },
    );
  }

  try {
    const sample = await prisma.moderationSample.create({
      data: {
        label: parsed.data.label,
        content: parsed.data.content.slice(0, 2000),
        source: "MANUAL",
      },
      select: { id: true },
    });
    return Response.json({ ok: true, id: sample.id });
  } catch (error) {
    console.error("[owner/model] could not add a sample:", error);
    return Response.json({ ok: false, error: "Could not save that sample." }, { status: 500 });
  }
}
