import Link from "next/link";
import { notFound } from "next/navigation";
import { relativeTime } from "@guardbot/shared";
import {
  createTicketPanel,
  deleteTicketPanel,
  saveTicketSettings,
} from "@/app/actions";
import {
  categoryChannels,
  channelName,
  channelOptions,
  getGuildContext,
  roleOptions,
  textChannels,
} from "@/lib/guild";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, Field, Input, Textarea } from "@/components/ui";
import { ChannelSelect, RoleSelect } from "@/components/selects";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const { settings, channels, roles } = context;

  const [panels, tickets] = await Promise.all([
    prisma.ticketPanel.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ticket.findMany({
      where: { guildId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  const channelSelect = channelOptions(textChannels(channels));
  const categorySelect = channelOptions(categoryChannels(channels));
  const roleSelect = roleOptions(roles);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support desk"
        title="Tickets"
        description="Create support panels and follow every ticket that was opened in this server."
      />

      <Card
        title="Support panels"
        description="Every panel posts a message with a button that opens a private ticket channel."
      >
        {panels.length === 0 ? (
          <EmptyState
            title="No panels yet"
            description="Create one below and it posts instantly to the channel you pick."
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {panels.map((panel) => (
              <li key={panel.id} className="flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-200">
                    {panel.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    #{channelName(channels, panel.channelId)} · max {panel.maxOpenPerUser} open per
                    member · created {relativeTime(panel.createdAt)}
                  </span>
                </span>
                <a
                  href={`https://discord.com/channels/${guildId}/${panel.channelId}/${panel.messageId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  Open message
                </a>
                <form action={deleteTicketPanel.bind(null, guildId, panel.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={createTicketPanel.bind(null, guildId)}
          className="mt-6 space-y-4 border-t border-white/5 pt-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ChannelSelect
              name="channelId"
              label="Panel channel"
              description="The message with the ticket button is posted here."
              options={channelSelect.filter((option) => option.value !== "")}
            />
            <Field label="Title" htmlFor="title">
              <Input name="title" placeholder="Need help?" required />
            </Field>
          </div>

          <Field label="Description" htmlFor="description">
            <Textarea
              name="description"
              rows={3}
              placeholder="Click the button below to open a support ticket."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <ChannelSelect
              name="categoryId"
              label="Ticket category"
              description="Ticket channels are created here."
              options={categorySelect.filter((option) => option.value !== "")}
            />
            <RoleSelect
              name="supportRoleId"
              label="Support role"
              description="Gets access to every ticket channel."
              options={roleSelect.filter((option) => option.value !== "")}
            />
            <Field label="Max open tickets per member" htmlFor="maxOpenPerUser">
              <Input name="maxOpenPerUser" type="number" min={1} defaultValue={1} />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-4">
            {!context.canManage && (
              <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
            )}
            <SubmitButton disabled={!context.canManage}>Create panel</SubmitButton>
          </div>
        </form>
      </Card>

      <Card title="Tickets" description="The most recent tickets opened in this server.">
        {tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            description="Tickets created from a support panel show up here."
          />
        ) : (
          <>
            <ul className="space-y-2 sm:hidden">
              {tickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/dashboard/${guildId}/tickets/${ticket.id}`}
                      className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200 hover:text-brand-300"
                    >
                      {ticket.subject}
                    </Link>
                    <Badge tone={ticket.status === "OPEN" ? "green" : "neutral"}>
                      {ticket.status === "OPEN" ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] text-slate-500">
                    <span className="truncate">#{ticket.channelId}</span>
                    <span className="shrink-0">{relativeTime(ticket.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Subject</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Channel</th>
                    <th className="pb-3 pr-4 font-medium">Opened by</th>
                    <th className="pb-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/dashboard/${guildId}/tickets/${ticket.id}`}
                          className="text-slate-200 hover:text-brand-300"
                        >
                          {ticket.subject}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={ticket.status === "OPEN" ? "green" : "neutral"}>
                          {ticket.status === "OPEN" ? "Open" : "Closed"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                        {ticket.channelId}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{ticket.userId}</td>
                      <td className="py-3 text-xs text-slate-500">{relativeTime(ticket.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title="Ticket settings" description="Where ticket events are logged.">
        <form action={saveTicketSettings.bind(null, guildId)} className="space-y-4">
          <ChannelSelect
            name="ticketLogChannelId"
            label="Ticket log channel"
            description="Every ticket update is posted here."
            options={channelSelect}
            defaultValue={settings.ticketLogChannelId}
          />
          <div className="flex items-center justify-end gap-4">
            {!context.canManage && (
              <p className="text-xs text-amber-200">You need the Manage Server permission.</p>
            )}
            <SubmitButton disabled={!context.canManage}>Save ticket settings</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
