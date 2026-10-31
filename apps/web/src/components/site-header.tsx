"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { WEBSITE_NAME } from "@/lib/brand";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#commands", label: "Commands" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader({
  signedIn,
  inviteHref,
}: {
  signedIn: boolean;
  inviteHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="border-b border-white/[0.06] bg-[#05050d]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
          <Logo className="shrink-0" />

          <nav className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1 text-sm text-slate-400 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={signedIn ? "/dashboard" : "/api/auth/login"}
              className="btn btn-ghost hidden h-9 px-3.5 text-xs sm:inline-flex sm:text-sm"
            >
              {signedIn ? "Dashboard" : "Sign in"}
            </Link>
            <a
              href={inviteHref}
              className="btn btn-primary hidden h-9 px-3.5 text-xs sm:inline-flex sm:text-sm"
            >
              Add to Discord
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-site-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="btn btn-ghost h-10 w-10 shrink-0 p-0 md:hidden"
            >
              <span className="relative block h-4 w-5" aria-hidden="true">
                <span
                  className={`absolute left-0 top-0.5 h-[1.5px] w-5 rounded-full bg-current transition-transform duration-300 ${
                    open ? "translate-y-[6px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[7px] h-[1.5px] w-5 rounded-full bg-current transition-opacity duration-200 ${
                    open ? "opacity-0" : ""
                  }`}
                />
                <span
                  className={`absolute left-0 top-[13px] h-[1.5px] w-5 rounded-full bg-current transition-transform duration-300 ${
                    open ? "-translate-y-[6px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        <div
          id="mobile-site-menu"
          className={`overflow-hidden border-t border-white/[0.06] bg-[#06060f]/95 backdrop-blur-2xl transition-[max-height,opacity] duration-300 md:hidden ${
            open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-4">
            <nav className="grid gap-1" aria-label="Main navigation">
              {LINKS.map((link, index) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  <span>{link.label}</span>
                  <span className="font-mono text-[10px] text-slate-600">0{index + 1}</span>
                </a>
              ))}
            </nav>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3">
              <Link
                href={signedIn ? "/dashboard" : "/api/auth/login"}
                onClick={() => setOpen(false)}
                className="btn btn-ghost w-full"
              >
                {signedIn ? "Dashboard" : "Sign in"}
              </Link>
              <a
                href={inviteHref}
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                Add {WEBSITE_NAME}
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
