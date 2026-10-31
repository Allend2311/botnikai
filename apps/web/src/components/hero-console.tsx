const RAIL = [
  { label: "Overview", active: true },
  { label: "Moderation", active: false },
  { label: "Welcome", active: false },
  { label: "Tickets", active: false },
  { label: "Notifications", active: false },
];

const ACTIVITY = [
  {
    tone: "text-rose-300 bg-rose-500/10 border-rose-400/20",
    icon: "M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z",
    title: "Auto-mod removed an invite",
    detail: "#general · 2m ago",
  },
  {
    tone: "text-cyan-300 bg-cyan-500/10 border-cyan-400/20",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0",
    title: "New member welcomed",
    detail: "Welcome · just now",
  },
  {
    tone: "text-emerald-300 bg-emerald-500/10 border-emerald-400/20",
    icon: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2",
    title: "Live notification sent",
    detail: "#streams · 6m ago",
  },
];

export function HeroConsole() {
  return (
    <div className="reveal-up relative mx-auto mt-14 w-full max-w-6xl [animation-delay:180ms] sm:mt-20">
      <div
        className="absolute -inset-x-6 bottom-0 top-10 -z-10 rounded-[3rem] bg-gradient-to-r from-cyan-500/20 via-brand-500/20 to-violet-500/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="gradient-border surface-panel overflow-hidden rounded-2xl sm:rounded-[1.75rem]" aria-hidden="true">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400/70" />
              <span className="h-2 w-2 rounded-full bg-amber-300/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
            </span>
            <span className="truncate font-mono text-[10px] text-slate-500 sm:text-[11px]">
              kai://control-center/overview
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300 sm:text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            All systems nominal
          </span>
        </div>

        <div className="grid lg:grid-cols-[13.5rem_1fr]">
          <aside className="hidden border-r border-white/[0.06] bg-white/[0.012] p-4 lg:block">
            <p className="px-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Workspace
            </p>
            <div className="mt-3 space-y-1">
              {RAIL.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] font-medium ${
                    item.active
                      ? "border border-brand-400/20 bg-brand-500/[0.12] text-brand-100"
                      : "text-slate-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      item.active ? "bg-brand-300 shadow-[0_0_8px_rgba(165,180,252,0.9)]" : "bg-slate-700"
                    }`}
                  />
                  {item.label}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Connected
                </span>
              </div>
              <p className="mt-2 truncate text-[11px] font-semibold text-white">Nightfall HQ</p>
              <p className="mt-0.5 text-[10px] text-slate-500">24,891 members</p>
            </div>
          </aside>

          <div className="p-3.5 sm:p-5 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                  Server overview
                </p>
                <p className="mt-1 text-sm font-semibold text-white sm:text-base">
                  Everything is under control
                </p>
              </div>
              <span className="hidden rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[9px] text-slate-500 sm:block">
                LIVE SYNC
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[
                { label: "Cases", value: "1,284", trend: "+12%" },
                { label: "Open tickets", value: "3", trend: "stable" },
                { label: "Members", value: "24.8k", trend: "+304" },
                { label: "Automod", value: "Active", trend: "24/7" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/[0.065] bg-white/[0.025] px-3 py-3"
                >
                  <p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
                  <p className="mt-1.5 text-base font-semibold text-white sm:text-lg">{stat.value}</p>
                  <p className="mt-0.5 text-[9px] text-cyan-300/70">{stat.trend}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-white/[0.065] bg-ink-950/40 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Live activity
                </p>
                <span className="flex items-center gap-1.5 text-[9px] text-slate-600">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  streaming
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {ACTIVITY.map((item) => (
                  <li key={item.title} className="flex items-center gap-2.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${item.tone}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={item.icon} />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-medium text-slate-300">
                        {item.title}
                      </span>
                      <span className="block truncate text-[9px] text-slate-600">{item.detail}</span>
                    </span>
                    <span className="hidden h-1 w-8 overflow-hidden rounded-full bg-white/5 sm:block">
                      <span className="block h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400/70 to-brand-400/70" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-4 top-24 hidden items-center gap-2 rounded-xl border border-rose-400/20 bg-[#0c0c18]/90 px-3 py-2 shadow-xl shadow-rose-500/10 backdrop-blur-xl xl:flex">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-300">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[10px] font-medium text-slate-300">Auto-mod blocked a raid</span>
      </div>

      <div className="absolute -right-3 top-48 hidden items-center gap-2 rounded-xl border border-emerald-400/20 bg-[#0c0c18]/90 px-3 py-2 shadow-xl shadow-emerald-500/10 backdrop-blur-xl xl:flex">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
        <span className="text-[10px] font-medium text-slate-300">Ticket #284 resolved</span>
      </div>
    </div>
  );
}
