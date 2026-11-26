import { headers } from "next/headers";
import { prisma } from "./prisma";

/**
 * Client IP capture for signed-in users only.
 *
 * Netlify terminates TLS at the edge and forwards the real client address in
 * `x-nf-client-connection-ip`. The other headers are fallbacks for local dev,
 * Docker and other reverse proxies. The first hop of `x-forwarded-for` is the
 * client; anything after it is proxy infrastructure and is ignored.
 */
const IP_HEADERS = [
  "x-nf-client-connection-ip",
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for",
] as const;

type HeaderReader = { get(name: string): string | null };

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:.%]+$/;

function normalizeIp(value: string | null): string | null {
  const candidate = value?.split(",")[0]?.trim() ?? "";
  if (!candidate || candidate.length > 64) return null;
  if (!IPV4.test(candidate) && !IPV6.test(candidate)) return null;
  return candidate;
}

/** Extracts the client IP from a set of request headers. */
export function readClientIp(source: HeaderReader): string | null {
  for (const name of IP_HEADERS) {
    const ip = normalizeIp(source.get(name));
    if (ip) return ip;
  }
  return null;
}

export async function recordIpEvent(params: {
  userId: string;
  ip: string | null;
  userAgent?: string | null;
  kind?: "LOGIN" | "USAGE";
}): Promise<void> {
  if (!params.ip) return;

  try {
    await prisma.ipLoginEvent.create({
      data: {
        userId: params.userId,
        ip: params.ip,
        userAgent: params.userAgent?.slice(0, 300) ?? null,
        kind: params.kind ?? "USAGE",
      },
    });
  } catch (error) {
    // Logging must never break sign-in or page rendering.
    console.error("[ip] could not record the sign-in event:", error);
  }
}

/**
 * Records that a signed-in user used the site. Repeated page views from the
 * same user + IP refresh a single row instead of filling the table, while a
 * fresh login always creates its own event.
 */
export async function recordUsageIp(userId: string): Promise<void> {
  const source = await headers();
  const ip = readClientIp(source);
  if (!ip) return;

  const userAgent = source.get("user-agent")?.slice(0, 300) ?? null;
  const since = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const recent = await prisma.ipLoginEvent.findFirst({
      where: { userId, ip, kind: "USAGE", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    if (recent) {
      await prisma.ipLoginEvent.update({
        where: { id: recent.id },
        data: { createdAt: new Date(), userAgent: userAgent ?? recent.userAgent },
      });
      return;
    }

    await prisma.ipLoginEvent.create({
      data: { userId, ip, userAgent, kind: "USAGE" },
    });
  } catch (error) {
    console.error("[ip] could not record the usage event:", error);
  }
}
