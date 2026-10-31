"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    key: "",
    label: "Overview",
    icon: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  },
  {
    key: "moderation",
    label: "Moderation",
    icon: <path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z" />,
  },
  {
    key: "welcome",
    label: "Welcome & Roles",
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
  },
  {
    key: "role-requests",
    label: "Role Requests",
    icon: <path d="M12 3v18m9-9H3m16-6-3 3m0 6 3 3M5 6l3 3m0 6-3 3" />,
  },
  {
    key: "messages",
    label: "Messages",
    icon: <path d="M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h6" />,
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: <path d="M4 6h16v12H4zM4 8l8 5 8-5" />,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2" />,
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5 2-1.2-2-3.4-2.3.6a7.6 7.6 0 0 0-1.7-1L15.6 4H12.4l-.4 2.9c-.6.2-1.2.6-1.7 1l-2.3-.6-2 3.4L8 12a7.6 7.6 0 0 0 0 1.8l-2 1.2 2 3.4 2.3-.6c.5.4 1.1.8 1.7 1l.4 2.9h3.2l.4-2.9c.6-.2 1.2-.6 1.7-1l2.3.6 2-3.4-2-1.2c.1-.6.1-1.2 0-1.8Z" />
    ),
  },
];

function NavigationLabel({
  active,
  icon,
  label,
  badge,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
          active
            ? "border-brand-400/25 bg-brand-500/15 text-brand-200 shadow-[0_0_18px_-8px_rgba(129,140,248,0.9)]"
            : "border-white/[0.06] bg-white/[0.025] text-slate-500 group-hover:border-white/10 group-hover:text-slate-200"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-cyan-300">
          {badge}
        </span>
      ) : pending ? (
        <span
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brand-200/25 border-t-brand-200"
          aria-label="Loading"
        />
      ) : active ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300 shadow-[0_0_8px_rgba(165,180,252,0.9)]" />
      ) : null}
    </>
  );
}

export function DashboardNav({
  guildId,
  onNavigate,
  canUseNotifications = true,
  className = "",
}: {
  guildId: string;
  onNavigate?: () => void;
  canUseNotifications?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const base = `/dashboard/${guildId}`;

  return (
    <nav aria-label="Server dashboard" className={`flex flex-col gap-1 ${className}`}>
      {ITEMS.map((item) => {
        const href = item.key ? `${base}/${item.key}` : base;
        const active = item.key ? pathname.startsWith(href) : pathname === href;
        const badge =
          item.key === "notifications" && !canUseNotifications ? "Soon" : undefined;

        return (
          <Link
            key={item.key || "overview"}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              active
                ? "bg-gradient-to-r from-brand-500/[0.14] via-brand-500/[0.07] to-transparent text-brand-100"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
            }`}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan-300 to-brand-400 shadow-[0_0_10px_rgba(103,232,249,0.8)]"
                aria-hidden="true"
              />
            )}
            <NavigationLabel active={active} icon={item.icon} label={item.label} badge={badge} />
          </Link>
        );
      })}
    </nav>
  );
}
