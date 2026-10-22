import Link from "next/link";
import { notFound } from "next/navigation";
import { CASE_LABELS, isCaseType, relativeTime } from "@guardbot/shared";
import { getGuildContext } from "@/lib/guild";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, Stat } from "@/components/ui";
import { WEBSITE_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    key: "welcome",
    title: "Welcome messages",
    description: "Greet new members and hand out auto roles.",
    enabled: (settings: { welcomeEnabled: boolean }) => settings.welcomeEnabled,
  },
  {
    key: "tickets",
    title: "Ticket system",
    description: "Support panels and private ticket channels.",
    enabled: () => true,
  },
  {
    key: "notifications",
    title: "Live & post pings",
    description: "Announce streams and new posts.",
    enabled: (settings: { liveEnabled: boolean; postEnabled: boolean }) =>
      settings.liveEnabled || settings.postEnabled,
  },
  {
    key: "moderation",
    title: "Auto-moderation",
    description: "Filter links, spam, caps and banned words.",
    enabled: (automod: { enabled: boolean }) => automod.enabled,
  },
];

export default async function GuildOverviewPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const [caseCount, openTickets, warningCount, recentCases, recentTickets, commandStats] =
    await Promise.all([
      prisma.case.count({ where: { guildId } }),
      prisma.ticket.count({ where: { guildId, status: "OPEN" } }),
      prisma.warning.count({ where: { guildId } }),
      prisma.case.findMany({
        where: { guildId },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.ticket.findMany({
        where: { guildId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.commandStat.findMany({
        where: { guildId },
        orderBy: { count: "desc" },
        take: 5,
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Everything {WEBSITE_NAME} is doing in {context.guild.name}.
          </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Moderation cases" value={caseCount} />
        <Stat label="Open tickets" value={openTickets} />
        <Stat label="Active warnings" value={warningCount} />
        <Stat label="Members" value={context.guild.approximate_member_count ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Modules"
          description="See what is currently active."
          action={
            <Link
              href={`/dashboard/${guildId}/settings`}
              className="text-xs font-medium text-brand-300 hover:text-brand-200"
            >
              Configure
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {MODULES.map((module) => {
              const enabled =
                module.key === "moderation"
                  ? module.enabled(context.automod as never)
                  : module.enabled(context.settings as never);

              return (
                <li
                  key={module.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-ink-950/40 px-4 py-3"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-200">{module.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{module.description}</span>
                  </span>
                  <Badge tone={enabled ? "green" : "neutral"}>
                    {enabled ? "Active" : "Off"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title="Most used commands"
          description="What your moderators run the most."
          action={
            <Link
              href={`/dashboard/${guildId}/settings`}
              className="text-xs font-medium text-brand-300 hover:text-brand-200"
            >
              All settings
            </Link>
          }
        >
          {commandStats.length === 0 ? (
            <EmptyState
              title="No command usage yet"
              description="Once your moderators start using the slash commands the numbers show up here."
            />
          ) : (
            <ul className="space-y-3">
              {commandStats.map((stat) => {
                const max = commandStats[0]?.count || 1;
                return (
                  <li key={stat.id}>
                    <div className="flex items-center justify-between text-sm">
                      <code className="text-slate-300">/{stat.name}</code>
                      <span className="text-xs text-slate-500">{stat.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.max(6, (stat.count / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Recent moderation cases"
          action={
            <Link
              href={`/dashboard/${guildId}/moderation`}
              className="text-xs font-medium text-brand-300 hover:text-brand-200"
            >
              View all
            </Link>
          }
        >
          {recentCases.length === 0 ? (
            <EmptyState
              title="No cases yet"
              description="Moderation actions taken in Discord show up here with their reason and duration."
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {recentCases.map((entry) => (
                <li key={entry.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <Badge tone={entry.type === "BAN" || entry.type === "KICK" ? "red" : "amber"}>
                    {isCaseType(entry.type) ? CASE_LABELS[entry.type] : entry.type}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                    {entry.targetTag ?? entry.targetId}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {relativeTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent tickets"
          action={
            <Link
              href={`/dashboard/${guildId}/tickets`}
              className="text-xs font-medium text-brand-300 hover:text-brand-200"
            >
              View all
            </Link>
          }
        >
          {recentTickets.length === 0 ? (
            <EmptyState
              title="No tickets yet"
              description="Tickets opened from your support panel are listed here."
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {recentTickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <Badge tone={ticket.status === "OPEN" ? "green" : "neutral"}>
                    {ticket.status === "OPEN" ? "Open" : "Closed"}
                  </Badge>
                  <Link
                    href={`/dashboard/${guildId}/tickets/${ticket.id}`}
                    className="min-w-0 flex-1 truncate text-sm text-slate-300 hover:text-brand-300"
                  >
                    {ticket.subject}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">
                    {relativeTime(ticket.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
