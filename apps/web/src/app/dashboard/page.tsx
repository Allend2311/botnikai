import Link from "next/link";
import { redirect } from "next/navigation";
import {
  canManageGuild,
  getBotGuild,
  getUserGuilds,
  guildIconUrl,
  inviteUrl,
  type DiscordGuild,
} from "@/lib/discord";
import { avatarUrl } from "@/lib/discord";
import { getSession, SessionExpiredError, withAccessToken } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isBotOwner } from "@/lib/owners";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { Badge, EmptyState } from "@/components/ui";
import { WEBSITE_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const isOwner = await isBotOwner(session.user.discordId);

  let guilds: DiscordGuild[] = [];
  try {
    guilds = await withAccessToken(session, getUserGuilds);
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect("/?error=session_expired");
    }
    console.error("[dashboard] could not load guilds:", error);
  }

  const manageable = guilds.filter((guild) => canManageGuild(guild.permissions));

  const results = await Promise.all(
    manageable.map(async (guild) => {
      const botGuild = await getBotGuild(guild.id).catch(() => null);
      return { guild, installed: botGuild !== null };
    }),
  );

  const active = results.filter((entry) => entry.installed);
  const pending = results.filter((entry) => !entry.installed);

  // Keep the local mirror of the guilds fresh.
  await Promise.all(
    active.map((entry) =>
      prisma.guild.upsert({
        where: { id: entry.guild.id },
        update: {
          name: entry.guild.name,
          icon: entry.guild.icon,
          ownerId: entry.guild.owner ? session.user.discordId : "",
          memberCount: entry.guild.approximate_member_count ?? 0,
        },
        create: {
          id: entry.guild.id,
          name: entry.guild.name,
          icon: entry.guild.icon,
          ownerId: entry.guild.owner ? session.user.discordId : "",
          memberCount: entry.guild.approximate_member_count ?? 0,
        },
      }),
    ),
  );

  const avatar = avatarUrl(session.user.discordId, session.user.avatar);
  const displayName = session.user.globalName ?? session.user.username;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="border-b border-white/[0.06] bg-[#05050d]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Logo showTagline={false} />
            <div className="flex items-center gap-2 sm:gap-3">
              {isOwner && (
                <Link
                  href="/owner/broadcast"
                  className="btn btn-ghost px-3 py-2 text-xs"
                  title="Send a bot update to every server"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 11a8 8 0 0 1 8-8m0 18a8 8 0 0 0 8-8M8 12a4 4 0 0 1 4-4m0 8a4 4 0 0 0 4-4" strokeLinecap="round" />
                  </svg>
                  Broadcast
                </Link>
              )}
              <div className="flex items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.025] py-1 pl-1 pr-2 sm:pr-3">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/15" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[10px] font-semibold text-white ring-1 ring-white/15">
                    {session.user.username.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[10rem] truncate text-xs font-medium text-slate-300 sm:block">
                  {displayName}
                </span>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="page-enter mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              Command center
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              Choose your <span className="text-gradient-soft">server</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
              {WEBSITE_NAME} can be added to as many servers as you like. Pick a server where it is
              installed and where you have the Manage Server permission.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">Online</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">{active.length}</p>
              </div>
              <span className="h-8 w-px bg-white/[0.07]" />
              <div>
                <p className="text-[9px] uppercase tracking-[0.16em] text-slate-500">Pending</p>
                <p className="mt-1 text-lg font-semibold text-amber-300">{pending.length}</p>
              </div>
            </div>
            <a href={inviteUrl()} className="btn btn-primary">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add {WEBSITE_NAME}
            </a>
          </div>
        </div>

        {active.length === 0 && pending.length === 0 && (
          <div className="mt-10">
            <EmptyState
              title="No servers available yet"
              description={`${WEBSITE_NAME} can only manage servers where it is installed and you have the Manage Server permission.`}
              action={
                <a href={inviteUrl()} className="btn btn-primary">
                  Add {WEBSITE_NAME} to a server
                </a>
              }
            />
          </div>
        )}

        {active.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-white">Managed servers</h2>
                <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-slate-500">
                  {active.length}
                </span>
              </div>
              <span className="hidden items-center gap-1.5 text-[10px] text-slate-500 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live connection
              </span>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {active.map((entry) => {
                const icon = guildIconUrl(entry.guild.id, entry.guild.icon);

                return (
                  <li key={entry.guild.id}>
                    <Link
                      href={`/dashboard/${entry.guild.id}`}
                      className="surface-panel hover-lift group flex h-full flex-col rounded-2xl p-5 hover:border-cyan-400/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="h-12 w-12 rounded-2xl ring-1 ring-white/10" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-cyan-500/15 text-lg font-semibold text-brand-100 ring-1 ring-white/10">
                            {entry.guild.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <Badge tone="green">
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Online
                        </Badge>
                      </div>
                      <div className="mt-4 min-w-0 flex-1">
                        <p className="truncate font-semibold text-white">{entry.guild.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {(entry.guild.approximate_member_count ?? 0).toLocaleString()} members
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                        <span className="font-mono text-[9px] text-slate-600">CONNECTED</span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-200 transition group-hover:text-white">
                          Open workspace
                          <svg viewBox="0 0 24 24" className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {pending.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm font-semibold text-white">
              {active.length > 0
                ? `Add ${WEBSITE_NAME} to more servers`
                : `Add ${WEBSITE_NAME} to your servers`}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              You have the Manage Server permission in these servers, but the bot has not been added
              yet.
            </p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pending.map((entry) => {
                const icon = guildIconUrl(entry.guild.id, entry.guild.icon);

                return (
                  <li key={entry.guild.id}>
                    <div className="flex h-full items-center gap-3 rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.015] p-4 transition hover:border-white/20 sm:gap-4 sm:p-5">
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" className="h-11 w-11 rounded-xl opacity-70 ring-1 ring-white/10 sm:h-12 sm:w-12 sm:rounded-2xl" />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-base font-semibold text-slate-300 ring-1 ring-white/10 sm:h-12 sm:w-12 sm:rounded-2xl sm:text-lg">
                          {entry.guild.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">
                          {entry.guild.name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {(entry.guild.approximate_member_count ?? 0).toLocaleString()} members
                        </span>
                      </span>
                      <a
                        href={inviteUrl(entry.guild.id)}
                        className="btn btn-ghost shrink-0 px-3 py-1.5 text-xs"
                      >
                        Invite
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
