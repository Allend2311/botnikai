"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    key: "",
    label: "Overview",
    icon: (
      <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />
    ),
  },
  {
    key: "moderation",
    label: "Moderation",
    icon: <path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z" />,
  },
  {
    key: "welcome",
    label: "Welcome & Roles",
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />
    ),
  },
  {
    key: "role-requests",
    label: "Role Requests",
    icon: <path d="M12 3v18m9-9H3m16-6-3 3m0 6 3 3M5 6l3 3m0 6-3 3" />,
  },
  {
    key: "tickets",
    label: "Tickets",
    icon: <path d="M4 6h16v12H4zM4 8l8 5 8-5" />,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: (
      <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2" />
    ),
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5 2-1.2-2-3.4-2.3.6a7.6 7.6 0 0 0-1.7-1L15.6 4H12.4l-.4 2.9c-.6.2-1.2.6-1.7 1l-2.3-.6-2 3.4L8 12a7.6 7.6 0 0 0 0 1.8l-2 1.2 2 3.4 2.3-.6c.5.4 1.1.8 1.7 1l.4 2.9h3.2l.4-2.9c.6-.2 1.2-.6 1.7-1l2.3.6 2-3.4-2-1.2c.1-.6.1-1.2 0-1.8Z" />
    ),
  },
];

export function DashboardNav({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${guildId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map((item) => {
        const href = item.key ? `${base}/${item.key}` : base;
        const active = item.key ? pathname.startsWith(href) : pathname === href;

        return (
          <Link
            key={item.key || "overview"}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-brand-600/15 text-brand-200 ring-1 ring-brand-500/25"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
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
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
