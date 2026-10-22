import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuildContext } from "@/lib/guild";
import { guildIconUrl, inviteUrl } from "@/lib/discord";
import { getSession } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { DashboardNav } from "@/components/dashboard-nav";
import { WEBSITE_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const [context, session] = await Promise.all([getGuildContext(guildId), getSession()]);

  if (!context || !session) notFound();

  const icon = guildIconUrl(context.guild.id, context.guild.icon);
  const avatar = avatarUrl(session.user.discordId, session.user.avatar);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden h-6 w-px bg-white/10 sm:block" />
            <Link
              href="/dashboard"
              className="hidden items-center gap-2.5 text-sm text-slate-300 transition hover:text-white sm:flex"
            >
              {icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="h-7 w-7 rounded-lg" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600/20 text-[10px] font-semibold text-brand-200">
                  {context.guild.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="max-w-[12rem] truncate font-medium">{context.guild.name}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {session.user.username.slice(0, 2).toUpperCase()}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:flex-row lg:gap-10">
        <aside className="lg:w-56 lg:shrink-0">
          <DashboardNav guildId={guildId} />

          <div className="mt-8 hidden rounded-xl border border-white/5 bg-ink-900/60 p-4 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Server</p>
            <p className="mt-2 truncate text-sm font-medium text-white">{context.guild.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {context.guild.approximate_member_count ?? 0} members
            </p>
            <a
              href={inviteUrl()}
              className="mt-4 block rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Invite {WEBSITE_NAME}
            </a>
          </div>

          {!context.canManage && (
            <p className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
              You need the Manage Server permission to change these settings.
            </p>
          )}
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
