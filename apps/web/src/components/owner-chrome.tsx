"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";

const LINKS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/security", label: "IP log" },
  { href: "/owner/model", label: "Moderation model" },
  { href: "/owner/profile", label: "Bot profile" },
  { href: "/owner/broadcast", label: "Broadcast" },
];

export function OwnerChrome({
  displayName,
  children,
}: {
  displayName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
        <div className="border-b border-white/[0.06] bg-[#05050d]/85 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Logo showTagline={false} />
              <span className="hidden rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200 sm:inline-flex">
                Owner
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/dashboard" className="btn btn-ghost px-3 py-2 text-xs">
                Dashboard
              </Link>
              {displayName && (
                <span className="hidden max-w-[10rem] truncate text-xs font-medium text-slate-400 md:block">
                  {displayName}
                </span>
              )}
              <LogoutButton />
            </div>
          </div>

          <nav aria-label="Owner tools" className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-violet-500/15 text-violet-100 ring-1 ring-violet-400/25"
                        : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="page-enter mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
