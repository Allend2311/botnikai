import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isBotOnline } from "@/lib/bot-status";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json(
      { error: "Sign in to view bot status." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const status = await prisma.botStatus.findUnique({ where: { id: "primary" } });
  return Response.json(
    { online: isBotOnline(status) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
