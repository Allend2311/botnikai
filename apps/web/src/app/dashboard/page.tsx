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
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { Badge, EmptyState } from "@/components/ui";
import { WEBSITE_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/");

  let guilds: DiscordGuild[] = [];
  try {
    guilds = await getUserGuilds(session.accessToken);
  } catch (error) {
    console.error("[dashboard] could not load guilds:", error);
  }

  const manageable = guilds.filter((guild) => canManageGuild(guild.permissions));

  const results = await Promise.all(
    manageable.map(async (guild) => {
      const botGuild = await getBotGuild(guild.id).catch(() => null);
      return botGuild ? { guild, botGuild } : null;
    }),
  );

  const active = results.filter((entry): entry is { guild: DiscordGuild; botGuild: DiscordGuild } =>
    entry !== null,
  );

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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-8 w-8 rounded-full" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {session.user.username.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="hidden text-sm text-slate-300 sm:block">
                {session.user.globalName ?? session.user.username}
              </span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Choose a server
          </h1>
          <p className="mt-3 text-slate-400">
            Pick a server where {WEBSITE_NAME} is installed and where you have the Manage Server
            permission.
          </p>
        </div>

        {active.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="No servers available yet"
              description={`${WEBSITE_NAME} can only manage servers where it is installed and you have the Manage Server permission.`}
              action={
                <a
                  href={inviteUrl()}
                  className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
                >
                  Add {WEBSITE_NAME} to a server
                </a>
              }
            />
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((entry) => {
              const icon = guildIconUrl(entry.guild.id, entry.guild.icon);

              return (
                <li key={entry.guild.id}>
                  <Link
                    href={`/dashboard/${entry.guild.id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-white/5 bg-ink-900/60 p-5 transition hover:border-brand-500/40 hover:bg-ink-900"
                  >
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icon} alt="" className="h-12 w-12 rounded-2xl" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 text-lg font-semibold text-brand-200">
                        {entry.guild.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white">{entry.guild.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {entry.guild.approximate_member_count ?? 0} members
                      </span>
                    </span>
                    <Badge tone="green" >
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Online
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
