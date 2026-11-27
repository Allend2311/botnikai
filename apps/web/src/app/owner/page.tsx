import Link from "next/link";
import type { ReactNode } from "react";
import { CASE_LABELS, formatDateTime, isCaseType, relativeTime } from "@guardbot/shared";
import { OwnerChrome } from "@/components/owner-chrome";
import { PageHeader, StatusPill } from "@/components/page-header";
import { Badge, Card, EmptyState, Stat } from "@/components/ui";
import { isBotOnline } from "@/lib/bot-status";
import { getLatestModel } from "@/lib/moderation-model";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const number = (value: number) => value.toLocaleString();

const TOOLS: Array<{
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  footer: string;
}> = [
  {
    href: "/owner/security",
    label: "IP log",
    description: "Review addresses and sign-in activity for every Discord account.",
    icon: <path d="M12 4a8 8 0 0 0-8 8 8 8 0 0 0 8 8 8 8 0 0 0 8-8 8 8 0 0 0-8-8Zm0 4v4l3 2" />,
    footer: "Security",
  },
  {
    href: "/owner/model",
    label: "Moderation model",
    description: "Train and test the classifier on messages GuardBot removed.",
    icon: <path d="M12 3 4 6.5v5.2c0 4.4 3 8.5 8 9.8 5-1.3 8-5.4 8-9.8V6.5L12 3Zm-2 9 2 2 4-4" />,
    footer: "Classifier",
  },
  {
    href: "/owner/profile",
    label: "Bot profile",
    description: "Update the bot's Discord username and avatar.",
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
    footer: "Discord",
  },
  {
    href: "/owner/broadcast",
    label: "Broadcast",
    description: "Send one announcement to every server the bot is in.",
    icon: <path d="M4 11a8 8 0 0 1 8-8m0 18a8 8 0 0 0 8-8M8 12a4 4 0 0 1 4-4m0 8a4 4 0 0 0 4-4" strokeLinecap="round" />,
    footer: "All servers",
  },
];

export default async function OwnerOverviewPage() {
  const user = await getSessionUser();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    guilds,
    userCount,
    activeSessions,
    commandTotal,
    topCommands,
    caseCount,
    casesLast7,
    casesByType,
    recentCases,
    openTickets,
    pendingRequests,
    pendingSchedules,
    automodEnabled,
    sampleCount,
    model,
    ipCount,
    uniqueIps,
    recentIpEvents,
    botStatus,
    casesByGuild,
    openTicketsByGuild,
  ] = await Promise.all([
    prisma.guild.findMany({ orderBy: { memberCount: "desc" } }),
    prisma.user.count(),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.commandStat.aggregate({ _sum: { count: true } }),
    prisma.commandStat.groupBy({
      by: ["name"],
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 6,
    }),
    prisma.case.count(),
    prisma.case.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.case.groupBy({
      by: ["type"],
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
      take: 6,
    }),
    prisma.case.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.roleRequest.count({
      where: { status: { in: ["PENDING_VOUCH", "PENDING_REVIEW", "APPROVING"] } },
    }),
    prisma.scheduledMessage.count({ where: { status: "PENDING" } }),
    prisma.automodConfig.count({ where: { enabled: true } }),
    prisma.moderationSample.count(),
    getLatestModel(),
    prisma.ipLoginEvent.count(),
    prisma.ipLoginEvent.groupBy({ by: ["ip"] }),
    prisma.ipLoginEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true, globalName: true } } },
    }),
    prisma.botStatus.findUnique({ where: { id: "primary" } }),
    prisma.case.groupBy({ by: ["guildId"], _count: { _all: true } }),
    prisma.ticket.groupBy({
      by: ["guildId"],
      where: { status: "OPEN" },
      _count: { _all: true },
    }),
  ]);

  const guildNames = new Map(guilds.map((guild) => [guild.id, guild.name]));
  const casesByGuildMap = new Map(casesByGuild.map((row) => [row.guildId, row._count._all]));
  const ticketsByGuildMap = new Map(openTicketsByGuild.map((row) => [row.guildId, row._count._all]));
  const totalCommands = commandTotal._sum.count ?? 0;
  const maxCommandCount = Math.max(1, ...topCommands.map((row) => row._sum.count ?? 0));
  const maxCaseTypeCount = Math.max(1, ...casesByType.map((row) => row._count._all));
  const botOnline = isBotOnline(botStatus);

  return (
    <OwnerChrome displayName={user ? user.globalName ?? user.username : undefined}>
      <PageHeader
        eyebrow="Owner only"
        title={
          <>
            Admin <span className="text-gradient-soft">dashboard</span>
          </>
        }
        description="A live snapshot of GuardBot across every server: reach, moderation, tickets, commands and security. These pages are hidden from everyone except the bot owner."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={botOnline ? "Bot online" : "Bot offline"}
              tone={botOnline ? "emerald" : "rose"}
            />
            <Badge tone="violet">Private</Badge>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Servers" value={number(guilds.length)} hint="In the local guild mirror" />
        <Stat
          label="Members served"
          value={number(guilds.reduce((sum, guild) => sum + guild.memberCount, 0))}
          hint="Across all known servers"
        />
        <Stat
          label="Signed-in users"
          value={number(userCount)}
          hint={`${number(activeSessions)} active sessions`}
        />
        <Stat label="Commands run" value={number(totalCommands)} hint="All guilds combined" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Moderation cases"
          value={number(caseCount)}
          hint={`${number(casesLast7)} in the last 7 days`}
        />
        <Stat label="Open tickets" value={number(openTickets)} hint="Awaiting a reply" />
        <Stat
          label="Pending requests"
          value={number(pendingRequests)}
          hint="Role requests awaiting review"
        />
        <Stat
          label="IP events"
          value={number(ipCount)}
          hint={`${number(uniqueIps.length)} distinct addresses`}
        />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-white">Admin tools</h2>
          <span className="hidden text-[10px] uppercase tracking-[0.14em] text-slate-600 sm:block">
            Owner access only
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="surface-panel hover-lift group flex h-full flex-col rounded-2xl p-5 transition hover:border-violet-400/25"
            >
              <span className="icon-tile flex h-9 w-9 items-center justify-center rounded-lg text-violet-300">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {tool.icon}
                </svg>
              </span>
              <span className="mt-4 flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{tool.label}</span>
                <span className="text-[11px] font-medium text-violet-200 transition group-hover:text-white">
                  Open →
                </span>
              </span>
              <span className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">
                {tool.description}
              </span>
              <span className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">
                {tool.footer}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.65fr),minmax(19rem,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card
            title="Top servers"
            description="Largest servers in the local mirror, with their moderation and ticket load."
            action={
              <Link
                href="/dashboard"
                className="text-xs font-medium text-brand-300 hover:text-brand-200"
              >
                All servers →
              </Link>
            }
          >
            {guilds.length === 0 ? (
              <EmptyState
                title="No servers synced yet"
                description="Servers appear here once the bot is installed and someone opens the dashboard."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Server</th>
                      <th className="pb-3 pr-4 font-medium">Members</th>
                      <th className="pb-3 pr-4 font-medium">Cases</th>
                      <th className="pb-3 pr-4 font-medium">Open tickets</th>
                      <th className="pb-3 font-medium">Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {guilds.slice(0, 6).map((guild) => (
                      <tr key={guild.id}>
                        <td className="max-w-[14rem] py-2.5 pr-4">
                          <Link
                            href={`/dashboard/${guild.id}`}
                            className="block truncate font-medium text-slate-200 hover:text-brand-300"
                          >
                            {guild.name}
                          </Link>
                          <span className="block truncate font-mono text-[10px] text-slate-600">
                            {guild.id}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-300">
                          {number(guild.memberCount)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-300">
                          {number(casesByGuildMap.get(guild.id) ?? 0)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-300">
                          {number(ticketsByGuildMap.get(guild.id) ?? 0)}
                        </td>
                        <td
                          className="whitespace-nowrap py-2.5 text-slate-500"
                          title={formatDateTime(guild.syncedAt)}
                        >
                          {relativeTime(guild.syncedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Recent moderation cases"
            description="The latest actions logged across all servers."
            action={
              <Link
                href="/dashboard"
                className="text-xs font-medium text-brand-300 hover:text-brand-200"
              >
                Server dashboards →
              </Link>
            }
          >
            {recentCases.length === 0 ? (
              <EmptyState
                title="No cases recorded yet"
                description="Moderation actions appear here as moderators and auto-mod take action."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Case</th>
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Server</th>
                      <th className="pb-3 pr-4 font-medium">Target</th>
                      <th className="pb-3 font-medium">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {recentCases.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-2.5 pr-4 font-mono text-slate-400">
                          #{entry.caseNumber}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge tone="amber">
                            {isCaseType(entry.type) ? CASE_LABELS[entry.type] : entry.type}
                          </Badge>
                        </td>
                        <td className="max-w-[10rem] truncate py-2.5 pr-4 text-slate-300">
                          {guildNames.get(entry.guildId) ?? entry.guildId}
                        </td>
                        <td
                          className="max-w-[11rem] truncate py-2.5 pr-4 font-mono text-slate-400"
                          title={entry.targetId}
                        >
                          {entry.targetTag ?? entry.targetId}
                        </td>
                        <td
                          className="whitespace-nowrap py-2.5 text-slate-500"
                          title={formatDateTime(entry.createdAt)}
                        >
                          {relativeTime(entry.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Latest sign-in activity"
            description="The five most recent events from signed-in users."
            action={
              <Link
                href="/owner/security"
                className="text-xs font-medium text-violet-200 hover:text-white"
              >
                Full IP log →
              </Link>
            }
          >
            {recentIpEvents.length === 0 ? (
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
                    {recentIpEvents.map((event) => (
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
                        <td className="whitespace-nowrap py-2.5 text-slate-500">
                          {formatDateTime(event.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="System health" description="Live signals from the bot and scheduled work.">
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Bot process</dt>
                <dd>
                  <Badge tone={botOnline ? "green" : "red"}>
                    {botOnline ? "Online" : "Offline"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Last heartbeat</dt>
                <dd className="text-right text-slate-300">
                  {botStatus?.lastHeartbeatAt ? relativeTime(botStatus.lastHeartbeatAt) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Auto-mod enabled</dt>
                <dd className="font-mono text-slate-300">
                  {number(automodEnabled)} / {number(guilds.length)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Scheduled messages</dt>
                <dd className="font-mono text-slate-300">{number(pendingSchedules)} pending</dd>
              </div>
            </dl>
          </Card>

          <Card title="Command activity" description="Most-used commands across every server.">
            {topCommands.length === 0 ? (
              <p className="text-xs text-slate-500">No command usage recorded yet.</p>
            ) : (
              <ul className="space-y-3.5">
                {topCommands.map((entry) => (
                  <li key={entry.name}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-mono text-slate-300">/{entry.name}</span>
                      <span className="shrink-0 font-mono text-slate-400">
                        {number(entry._sum.count ?? 0)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400"
                        style={{
                          width: `${Math.round(((entry._sum.count ?? 0) / maxCommandCount) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Moderation mix" description="Case types recorded across all servers.">
            {casesByType.length === 0 ? (
              <p className="text-xs text-slate-500">No moderation cases recorded yet.</p>
            ) : (
              <ul className="space-y-3.5">
                {casesByType.map((entry) => (
                  <li key={entry.type}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-slate-300">
                        {isCaseType(entry.type) ? CASE_LABELS[entry.type] : entry.type}
                      </span>
                      <span className="shrink-0 font-mono text-slate-400">
                        {number(entry._count._all)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-400"
                        style={{
                          width: `${Math.round((entry._count._all / maxCaseTypeCount) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Classifier snapshot"
            description="Training data and the last stored moderation model."
            action={
              <Link
                href="/owner/model"
                className="text-xs font-medium text-violet-200 hover:text-white"
              >
                Trainer →
              </Link>
            }
          >
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Labelled samples</dt>
                <dd className="font-mono text-slate-300">{number(sampleCount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Model accuracy</dt>
                <dd className="font-mono text-slate-300">
                  {model?.accuracy == null ? "—" : `${Math.round(model.accuracy * 100)}%`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Trained</dt>
                <dd className="text-right text-slate-300">
                  {model ? formatDateTime(model.trainedAt) : "Not trained yet"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </OwnerChrome>
  );
}
