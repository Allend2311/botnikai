import { getSession } from "@/lib/session";
import { recordUsageIp } from "@/lib/ip";

export const dynamic = "force-dynamic";

/**
 * Shared guard for the signed-in area. Every dashboard page view records a
 * throttled IP event so the owner can see where accounts are being used from.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) await recordUsageIp(session.user.id);

  return <>{children}</>;
}
