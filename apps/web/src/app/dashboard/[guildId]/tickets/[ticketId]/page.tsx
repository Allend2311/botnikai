import Link from "next/link";
import { notFound } from "next/navigation";
import { relativeTime } from "@guardbot/shared";
import { getGuildContext } from "@/lib/guild";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ guildId: string; ticketId: string }>;
}) {
  const { guildId, ticketId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, guildId },
  });

  if (!ticket) notFound();

  const transcript = await prisma.ticketTranscript.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/${guildId}/tickets`}
          className="text-xs font-medium text-brand-300 hover:text-brand-200"
        >
          ← Back to tickets
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{ticket.subject}</h1>
          <Badge tone={ticket.status === "OPEN" ? "green" : "neutral"}>
            {ticket.status === "OPEN" ? "Open" : "Closed"}
          </Badge>
        </div>
        <p className="mt-1.5 text-sm text-slate-400">
          Opened {relativeTime(ticket.createdAt)}
          {ticket.closedAt ? ` · closed ${relativeTime(ticket.closedAt)}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Opened by</dt>
              <dd className="font-mono text-xs text-slate-300">{ticket.userId}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Channel</dt>
              <dd className="font-mono text-xs text-slate-300">{ticket.channelId}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Closed by</dt>
              <dd className="font-mono text-xs text-slate-300">{ticket.closedBy ?? "—"}</dd>
            </div>
          </dl>
          <a
            href={`https://discord.com/channels/${guildId}/${ticket.channelId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Open in Discord
          </a>
        </Card>

        <Card title="Transcript" className="lg:col-span-2">
          {transcript.length === 0 ? (
            <EmptyState
              title="No transcript stored"
              description="Transcripts are captured when a ticket is closed. Tickets that are still open do not have one yet."
            />
          ) : (
            <ul className="space-y-3">
              {transcript.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-white/5 bg-ink-950/40 px-4 py-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">
                    {entry.content}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-600">{relativeTime(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
