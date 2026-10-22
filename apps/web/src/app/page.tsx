import Link from "next/link";
import { APP_TAGLINE } from "@guardbot/shared";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "@/lib/brand";
import { inviteUrl } from "@/lib/discord";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/logo";

const FEATURES = [
  {
    icon: (
      <path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z" />
    ),
    title: "Moderation & auto-mod",
    description:
      "Ban, kick, timeout, warn, purge, lock channels and slowmode — every action is logged in a case history and mirrored to your mod-log channel.",
    accent: "from-rose-500/20 to-rose-500/0 text-rose-300",
  },
  {
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />
    ),
    title: "Welcome, roles & reactions",
    description:
      "Greet new members with a custom message, hand out auto-roles automatically and let people claim extra roles by reacting to a message.",
    accent: "from-brand-500/20 to-brand-500/0 text-brand-300",
  },
  {
    icon: (
      <path d="M4 6h16v12H4zM4 8l8 5 8-5" />
    ),
    title: "Ticket system",
    description:
      "Support panels, private ticket channels, transcripts and a full ticket history that you can browse straight from the dashboard.",
    accent: "from-sky-500/20 to-sky-500/0 text-sky-300",
  },
  {
    icon: (
      <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2" />
    ),
    title: "Live & streaming pings",
    description:
      "The moment a member goes live on Twitch, YouTube or Kick, your channel is notified and the streamer role gets pinged.",
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
  },
  {
    icon: (
      <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
    ),
    title: "New post notifications",
    description:
      "Forum posts and channel announcements are reposted to your notification channel with a preview, a jump link and an optional ping.",
    accent: "from-amber-500/20 to-amber-500/0 text-amber-300",
  },
  {
    icon: (
      <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm3 0 2 2 4-4" />
    ),
    title: "Web dashboard",
    description:
      "Sign in with Discord and configure everything — auto-mod rules, welcome messages, roles, tickets and notification channels.",
    accent: "from-violet-500/20 to-violet-500/0 text-violet-300",
  },
];

const STEPS = [
  {
    step: "01",
    title: `Add ${WEBSITE_NAME}`,
    description:
      "Invite the bot with the OAuth2 link above. It requests only the permissions it needs and shows up in your server instantly.",
  },
  {
    step: "02",
    title: "Pick your channels",
    description:
      `Use the slash commands in Discord or the dashboard to point ${WEBSITE_NAME} at your welcome, mod-log, live and ticket channels.`,
  },
  {
    step: "03",
    title: "Let it work",
    description:
      `${WEBSITE_NAME} moderates, welcomes, answers tickets and pings your community the second something worth knowing happens.`,
  },
];

const COMMAND_GROUPS = [
  {
    name: "Moderation",
    commands: [
      ["/ban", "Ban a member with a reason"],
      ["/kick", "Kick a member from the server"],
      ["/mute", "Timeout a member for a while"],
      ["/warn", "Warn a member and track it"],
      ["/purge", "Bulk delete recent messages"],
      ["/lock", "Lock or unlock the channel"],
      ["/slowmode", "Set the slowmode delay"],
    ],
  },
  {
    name: "Setup",
    commands: [
      ["/welcome", "Configure the welcome message"],
      ["/goodbye", "Configure the farewell message"],
      ["/autorole", "Give roles to new members"],
      ["/reactionrole", "Roles through emoji reactions"],
      ["/ticketpanel", "Create the support panel"],
      ["/liveconfig", "Live & streaming notifications"],
      ["/postconfig", "New post notifications"],
    ],
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [user, guildCount, caseCount, ticketCount] = await Promise.all([
    getSessionUser(),
    prisma.guild.count().catch(() => 0),
    prisma.case.count().catch(() => 0),
    prisma.ticket.count().catch(() => 0),
  ]);

  const stats = [
    { label: "Servers protected", value: guildCount },
    { label: "Moderation cases", value: caseCount },
    { label: "Tickets handled", value: ticketCount },
    { label: "Uptime", value: "99.9%" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
            <a href="#commands" className="transition hover:text-white">
              Commands
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
              >
                Open dashboard
              </Link>
            ) : (
              <Link
                href="/api/auth/login"
                className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
              >
                Sign in
              </Link>
            )}
            <a
              href={inviteUrl()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500"
            >
              Add to Discord
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {error && (
          <div
            role="alert"
            className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
          >
            {error === "oauth_denied"
              ? "Discord sign-in was cancelled. Try again and approve the requested access."
              : error === "oauth_state"
                ? "Sign-in expired or could not be verified. Please try again."
                : "Discord sign-in failed. Check that the OAuth2 redirect URL in the Discord Developer Portal exactly matches your APP_URL followed by /api/auth/callback, then try again."}
          </div>
        )}

        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-20 text-center md:pt-28">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-brand-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
            </span>
            Moderation · Tickets · Live pings · Dashboard
          </div>

          <h1 className="mx-auto mt-7 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Keep your Discord server <span className="text-gradient">safe, busy and alive</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">{WEBSITE_DESCRIPTION}</p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={inviteUrl()}
              className="glow w-full rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 sm:w-auto"
            >
              Add {WEBSITE_NAME} to your server
            </a>
            <Link
              href="/dashboard"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 sm:w-auto"
            >
              Open the dashboard
            </Link>
          </div>

          <dl className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/5 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-ink-950 px-6 py-7 text-left">
                <dt className="text-xs uppercase tracking-wider text-slate-500">{stat.label}</dt>
                <dd className="mt-2 text-3xl font-semibold text-white">{stat.value.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">Features</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Everything a busy community needs
            </h2>
            <p className="mt-4 text-slate-400">
              {WEBSITE_NAME} covers the repetitive work so your moderators can focus on the humans.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-ink-900/60 p-6 transition hover:border-white/15"
              >
                <div
                  className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${feature.accent}`}
                />
                <div className={`relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent}`}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="relative mt-5 text-base font-semibold text-white">{feature.title}</h3>
                <p className="relative mt-2.5 text-sm leading-relaxed text-slate-400">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-white/5 bg-ink-900/30 py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Live in under two minutes
              </h2>
            </div>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((item) => (
                <li key={item.step} className="relative rounded-2xl border border-white/5 bg-ink-950/60 p-7">
                  <span className="font-mono text-sm font-semibold text-brand-400">{item.step}</span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Commands */}
        <section id="commands" className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-400">Commands</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Configure everything from Discord
            </h2>
            <p className="mt-4 text-slate-400">
              Every dashboard setting has a slash command counterpart, so you never have to leave your
              server to make a change.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {COMMAND_GROUPS.map((group) => (
              <div key={group.name} className="rounded-2xl border border-white/5 bg-ink-900/60 p-7">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                  {group.name}
                </h3>
                <ul className="mt-5 space-y-3">
                  {group.commands.map(([name, description]) => (
                    <li key={name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <code className="rounded-md bg-brand-500/10 px-2 py-0.5 font-mono text-[13px] text-brand-300 ring-1 ring-brand-500/20">
                        {name}
                      </code>
                      <span className="text-sm text-slate-400">{description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-white/5 bg-ink-900/30 py-20">
          <div className="mx-auto w-full max-w-3xl px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Frequently asked questions
            </h2>

            <div className="mt-12 space-y-4">
              {[
                {
                  q: "Does the bot need privileged intents?",
                  a: "Yes. Enable Server Members, Server Presence and Message Content in the Discord developer portal so welcome messages, live detection and auto-mod work as expected.",
                },
                {
                  q: "Where is my data stored?",
                  a: "In a SQLite database that ships with the project. The schema is PostgreSQL ready, so you can move to a hosted database without changing a single line of application code.",
                },
                {
                  q: "How do live notifications work?",
                  a: `${WEBSITE_NAME} listens to presence updates. When a member starts a stream on Twitch, YouTube or Kick, the announcement is posted to your chosen channel and the configured role is pinged.`,
                },
                {
                  q: "Can I manage everything from the website?",
                  a: "Yes. Sign in with Discord, pick a server where you have the Manage Server permission and configure auto-mod, welcome messages, roles, tickets and notifications.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-white/5 bg-ink-950/60 px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-white">
                    {item.q}
                    <span className="text-slate-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="glow overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/20 via-ink-900 to-ink-950 px-8 py-14 text-center">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {APP_TAGLINE}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">
              Free to use, self hosted and configured in minutes.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={inviteUrl()}
                className="w-full rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-500 sm:w-auto"
              >
                Add to Discord
              </a>
              <Link
                href="/dashboard"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 sm:w-auto"
              >
                Configure the bot
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 md:flex-row">
          <Logo />
          <p>
            {WEBSITE_NAME} — built with discord.js, Next.js and Prisma. Not affiliated with Discord Inc.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="transition hover:text-white">
              Dashboard
            </Link>
            <a href={inviteUrl()} className="transition hover:text-white">
              Invite
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
