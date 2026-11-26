import Link from "next/link";
import { formatDateTime } from "@guardbot/shared";
import { OwnerChrome } from "@/components/owner-chrome";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, EmptyState, Stat } from "@/components/ui";
import { getLatestModel } from "@/lib/moderation-model";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OwnerOverviewPage() {
  const user = await getSessionUser();

  const [ipCount, uniqueIps, sampleCount, caseCount, warningCount, model, recent] = await Promise.all([
    prisma.ipLoginEvent.count(),
    prisma.ipLoginEvent.groupBy({ by: ["ip"] }),
    prisma.moderationSample.count(),
    prisma.case.count(),
    prisma.warning.count(),
    getLatestModel(),
    prisma.ipLoginEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true, globalName: true } } },
    }),
  ]);

  return (
    <OwnerChrome displayName={user ? user.globalName ?? user.username : undefined}>
      <PageHeader
        eyebrow="Owner only"
        title={
          <>
            Admin <span className="text-gradient-soft">overview</span>
          </>
        }
        description="Security history for signed-in accounts and the moderation classifier training pipeline. These pages are hidden from everyone except the bot owner."
        action={<Badge tone="violet">Private</Badge>}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="IP events" value={ipCount} hint="Logins + throttled site usage" />
        <Stat label="Distinct IPs" value={uniqueIps.length} hint="Across all signed-in users" />
        <Stat label="Training samples" value={sampleCount} hint="Removed messages kept for training" />
        <Stat
          label="Model accuracy"
          value={model?.accuracy == null ? "—" : `${Math.round(model.accuracy * 100)}%`}
          hint={model ? "Held-out test split" : "No model trained yet"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Link
          href="/owner/security"
          className="surface-panel hover-lift group rounded-2xl p-5 transition hover:border-violet-400/25"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Sign-in activity</h2>
            <span className="text-xs font-medium text-violet-200 transition group-hover:text-white">
              Open IP log →
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Review the addresses used by signed-in Discord accounts, with timestamps and login type.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">
            {uniqueIps.length} unique addresses recorded
          </p>
        </Link>

        <Link
          href="/owner/model"
          className="surface-panel hover-lift group rounded-2xl p-5 transition hover:border-violet-400/25"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Moderation model</h2>
            <span className="text-xs font-medium text-violet-200 transition group-hover:text-white">
              Open trainer →
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Train a classifier from {sampleCount.toLocaleString()} removed-message samples, {caseCount.toLocaleString()} moderation cases and {warningCount.toLocaleString()} warnings, then test it on new text.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">
            {model ? `Last trained ${formatDateTime(model.trainedAt)}` : "Not trained yet"}
          </p>
        </Link>
      </div>

      <div className="mt-6">
        <Card title="Latest sign-in activity" description="The five most recent events from signed-in users.">
          {recent.length === 0 ? (
            <EmptyState
              title="No sign-ins recorded yet"
              description="IP events appear here after someone signs in with Discord or uses the dashboard."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">User</th>
                    <th className="pb-3 pr-4 font-medium">IP address</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 font-medium">When (PH time)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {recent.map((event) => (
                    <tr key={event.id}>
                      <td className="py-2.5 pr-4 text-slate-300">
                        {event.user.globalName ?? event.user.username}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-slate-300">{event.ip}</td>
                      <td className="py-2.5 pr-4">
                        <Badge tone={event.kind === "LOGIN" ? "green" : "neutral"}>
                          {event.kind.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-slate-500">{formatDateTime(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </OwnerChrome>
  );
}
