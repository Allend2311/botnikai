"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { DashboardNav } from "@/components/dashboard-nav";
import { WEBSITE_NAME } from "@/lib/brand";

export function DashboardChrome({
  guildId,
  guildName,
  guildIcon,
  memberCount,
  canManage,
  canUseNotifications,
  displayName,
  avatar,
  initials,
  inviteHref,
  children,
}: {
  guildId: string;
  guildName: string;
  guildIcon: string | null;
  memberCount: number;
  canManage: boolean;
  canUseNotifications: boolean;
  displayName: string;
  avatar: string | null;
  initials: string;
  inviteHref: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const guildBadge = guildIcon ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={guildIcon} alt="" className="h-7 w-7 rounded-lg ring-1 ring-white/10" />
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/30 to-cyan-500/20 text-[10px] font-semibold text-brand-100 ring-1 ring-white/10">
      {guildName.slice(0, 2).toUpperCase()}
    </span>
  );

  const userAvatar = avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatar} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/15" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[10px] font-semibold text-white ring-1 ring-white/15">
      {initials}
    </span>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="border-b border-white/[0.06] bg-[#05050d]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <Logo className="shrink-0" showTagline={false} />
              <span className="hidden h-6 w-px bg-white/10 sm:block" />
              <Link
                href="/dashboard"
                className="group flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 text-sm text-slate-300 transition hover:text-white sm:px-2"
                title="Switch server"
              >
                {guildBadge}
                <span className="max-w-[8rem] truncate font-medium sm:max-w-[14rem]">
                  {guildName}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="hidden h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-slate-300 sm:block"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="m8 10 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.025] py-1 pl-1 pr-3 sm:flex">
                {userAvatar}
                <span className="max-w-[10rem] truncate text-xs font-medium text-slate-300">
                  {displayName}
                </span>
              </div>
              <LogoutButton className="hidden sm:inline-flex" />
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-expanded={open}
                aria-controls="dashboard-mobile-menu"
                aria-label="Open dashboard navigation"
                className="btn btn-ghost h-10 w-10 shrink-0 p-0 lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8 lg:px-8 lg:py-8">
        <aside className="hidden lg:block lg:w-60 lg:shrink-0">
          <div className="sticky top-24">
            <p className="mb-2.5 flex items-center gap-2 px-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              <span className="h-1 w-1 rounded-full bg-cyan-400/80" />
              Workspace
            </p>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-2">
              <DashboardNav guildId={guildId} canUseNotifications={canUseNotifications} />
            </div>

            <div className="gradient-border mt-4 rounded-2xl bg-white/[0.025] p-4">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Connected server
                </p>
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-white">{guildName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {memberCount.toLocaleString()} members
              </p>
              <a
                href={inviteHref}
                className="btn btn-ghost mt-4 w-full px-3 py-2.5 text-xs"
              >
                Invite {WEBSITE_NAME}
              </a>
            </div>

            {!canManage && (
              <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200">
                You need the Manage Server permission to change these settings.
              </p>
            )}
          </div>
        </aside>

        <main className="page-enter min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile / tablet navigation drawer */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          id="dashboard-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Server navigation"
          className={`absolute inset-y-0 left-0 flex w-[min(21rem,88vw)] flex-col border-r border-white/10 bg-[#07070f] shadow-2xl shadow-black/60 transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
            <Logo showTagline={false} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              {guildBadge}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{guildName}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {memberCount.toLocaleString()} members
                </p>
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </div>

            <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-600">
              Workspace
            </p>
            <DashboardNav
              guildId={guildId}
              canUseNotifications={canUseNotifications}
              onNavigate={() => setOpen(false)}
            />

            {!canManage && (
              <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-amber-200">
                You need the Manage Server permission to change these settings.
              </p>
            )}
          </div>

          <div className="safe-bottom border-t border-white/[0.07] px-3 pt-3">
            <a href={inviteHref} className="btn btn-ghost mb-2 w-full">
              Invite {WEBSITE_NAME}
            </a>
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              {userAvatar}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                <p className="text-[10px] text-slate-500">Signed in with Discord</p>
              </div>
            </div>
            <LogoutButton className="w-full justify-center" />
          </div>
        </aside>
      </div>
    </div>
  );
}
