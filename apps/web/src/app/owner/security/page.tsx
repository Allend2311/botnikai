import { formatDateTime } from "@guardbot/shared";
import { OwnerChrome } from "@/components/owner-chrome";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, EmptyState, Stat } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OwnerSecurityPage() {
  const user = await getSessionUser();

  const [events, topIps, uniqueIps, totalCount, loginCount, userCount] = await Promise.all([
    prisma.ipLoginEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { username: true, globalName: true, discordId: true } } },
    }),
    prisma.ipLoginEvent.groupBy({ by: ["ip"], _count: { _all: true }, orderBy: { _count: { ip: "desc" } }, take: 8 }),
    prisma.ipLoginEvent.groupBy({ by: ["ip"] }),
    prisma.ipLoginEvent.count(),
    prisma.ipLoginEvent.count({ where: { kind: "LOGIN" } }),
    prisma.ipLoginEvent.groupBy({ by: ["userId"] }),
  ]);

  return (
    <OwnerChrome displayName={user ? user.globalName ?? user.username : undefined}>
      <PageHeader
        eyebrow="Owner only"
        title={
          <>
            IP <span className="text-gradient-soft">activity</span>
          </>
        }
        description="Addresses observed for signed-in Discord users. Anonymous visitors are not logged."
        action={<Badge tone="violet">Private</Badge>}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total events" value={totalCount} hint="Latest 100 shown below" />
        <Stat label="Sign-ins" value={loginCount} hint="Recorded at Discord login" />
        <Stat label="Users seen" value={userCount.length} hint="Distinct signed-in accounts" />
        <Stat label="Distinct IPs" value={uniqueIps.length} hint="Top addresses listed below" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,20rem]">
        <Card title="Recent events" description="Newest first. Repeated site usage from the same address refreshes one row per hour.">
          {events.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              description="Events appear after a user signs in with Discord or opens the dashboard."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">User</th>
                    <th className="pb-3 pr-4 font-medium">IP address</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Device</th>
                    <th className="pb-3 font-medium">When (PH time)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="py-2.5 pr-4">
                        <span className="block truncate text-slate-300">
                          {event.user.globalName ?? event.user.username}
                        </span>
                        <span className="block font-mono text-[10px] text-slate-600">{event.user.discordId}</span>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-300">{event.ip}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={event.kind === "LOGIN" ? "green" : "neutral"}>
                          {event.kind.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="max-w-[14rem] truncate py-2.5 pr-4 text-slate-500" title={event.userAgent ?? ""}>
                        {event.userAgent ?? "—"}
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-slate-500">{formatDateTime(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Top addresses" description="Most active addresses across all signed-in users.">
            {topIps.length === 0 ? (
              <p className="text-xs text-slate-500">No addresses recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {topIps.map((entry) => (
                  <li key={entry.ip} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-slate-300">{entry.ip}</span>
                    <Badge tone="blue">{entry._count._all}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="About this data">
            <p className="text-xs leading-relaxed text-slate-400">
              Only users who sign in with Discord are recorded. Addresses are stored server-side and are
              visible only to the owner. They are used to spot account misuse and abusive traffic — add a
              line to your privacy policy telling users that sign-in IPs are logged for security.
            </p>
          </Card>
        </div>
      </div>
    </OwnerChrome>
  );
}
