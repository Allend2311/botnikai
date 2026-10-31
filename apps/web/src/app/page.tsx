import Link from "next/link";
import { headers } from "next/headers";
import { APP_TAGLINE } from "@guardbot/shared";
import { WEBSITE_DESCRIPTION, WEBSITE_NAME } from "@/lib/brand";
import { getAppUrlForHeaders, getOAuthRedirectUri, inviteUrl } from "@/lib/discord";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { HeroConsole } from "@/components/hero-console";

const FEATURES = [
  {
    icon: <path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z" />,
    title: "Moderation & auto-mod",
    description:
      "Ban, kick, timeout, warn, purge, lock channels and slowmode — every action is logged in a case history and mirrored to your mod-log channel.",
    accent: "from-rose-500/20 to-rose-500/0 text-rose-300",
    glow: "bg-rose-500/10",
    tag: "Defense",
  },
  {
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
    title: "Welcome, roles & reactions",
    description:
      "Greet new members with a custom message, hand out auto-roles automatically and let people claim extra roles by reacting to a message.",
    accent: "from-brand-500/20 to-brand-500/0 text-brand-300",
    glow: "bg-brand-500/10",
    tag: "Onboarding",
  },
  {
    icon: <path d="M4 6h16v12H4zM4 8l8 5 8-5" />,
    title: "Ticket system",
    description:
      "Support panels, private ticket channels, transcripts and a full ticket history that you can browse straight from the dashboard.",
    accent: "from-sky-500/20 to-sky-500/0 text-sky-300",
    glow: "bg-sky-500/10",
    tag: "Support",
  },
  {
    icon: <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2" />,
    title: "Live & streaming pings",
    description:
      "When Discord reports a Kick or TikTok streaming activity, your channel is notified and the configured role gets pinged.",
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
    glow: "bg-emerald-500/10",
    tag: "Realtime",
  },
  {
    icon: <path d="M4 5h16v14H4zM8 9h8M8 13h5" />,
    title: "New post notifications",
    description:
      "Forum posts and channel announcements are reposted to your notification channel with a preview, a jump link and an optional ping.",
    accent: "from-amber-500/20 to-amber-500/0 text-amber-300",
    glow: "bg-amber-500/10",
    tag: "Broadcast",
  },
  {
    icon: <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm3 0 2 2 4-4" />,
    title: "Web dashboard",
    description:
      "Sign in with Discord and configure everything — auto-mod rules, welcome messages, roles, tickets and notification channels.",
    accent: "from-violet-500/20 to-violet-500/0 text-violet-300",
    glow: "bg-violet-500/10",
    tag: "Control",
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
    description: `Use the slash commands in Discord or the dashboard to point ${WEBSITE_NAME} at your welcome, mod-log, live and ticket channels.`,
  },
  {
    step: "03",
    title: "Let it work",
    description: `${WEBSITE_NAME} moderates, welcomes, answers tickets and pings your community the second something worth knowing happens.`,
  },
];

const COMMAND_GROUPS = [
  {
    name: "Moderation",
    icon: <path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z" />,
    accent: "from-rose-500/20 to-rose-500/0 text-rose-300",
    commands: [
      ["/ban", "Ban a member from the server"],
      ["/unban", "Unban a user by ID"],
      ["/kick", "Kick a member from the server"],
      ["/mute", "Timeout a member for a duration"],
      ["/unmute", "Remove timeout from a member"],
      ["/warn", "Warn a member"],
      ["/warnings", "List warnings for a member"],
      ["/removewarn", "Clear all warnings from a member"],
      ["/purge", "Delete recent messages in bulk"],
      ["/slowmode", "Set channel slowmode delay"],
      ["/lock", "Lock the current channel"],
      ["/unlock", "Unlock the current channel"],
      ["/modlogs", "View recent moderation cases"],
      ["/case", "Inspect a moderation case by number"],
      ["/delcase", "Delete a case from the history"],
      ["/softban", "Ban and unban to clear recent messages"],
      ["/role", "Add or remove a role from a member"],
      ["/nickname", "Change or reset a member nickname"],
      ["/nuke", "Recreate a channel and wipe its history"],
    ],
  },
  {
    name: "Welcome & Roles",
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
    accent: "from-brand-500/20 to-brand-500/0 text-brand-300",
    commands: [
      ["/welcome", "Configure welcome messages (channel/message/image/enable/disable/test)"],
      ["/goodbye", "Configure goodbye messages (channel/message/image/enable/disable)"],
      ["/autorole", "Auto-assign roles to new members (add/remove/list)"],
      ["/reactionrole", "Role assignment via reactions (add/remove/list)"],
    ],
  },
  {
    name: "Tickets",
    icon: <path d="M4 6h16v12H4zM4 8l8 5 8-5" />,
    accent: "from-sky-500/20 to-sky-500/0 text-sky-300",
    commands: [
      ["/ticketpanel", "Create/manage support ticket panels (create/list/remove)"],
      ["/ticket", "Manage tickets (close/add/remove/rename/info/list)"],
    ],
  },
  {
    name: "Live & Posts",
    icon: <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2" />,
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-300",
    commands: [
      ["/liveconfig", "Configure Kick/TikTok live notifications"],
      ["/livecheck", "Scan for members currently streaming"],
      ["/postconfig", "Configure forum/channel post notifications"],
      ["/posttest", "Send a test post announcement"],
    ],
  },
  {
    name: "Configuration",
    icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.1l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.9-1.1L14.8 3h-3.6l-.3 2.4a7.5 7.5 0 0 0-1.9 1.1l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 1.9 1.1l.3 2.4h3.6l.3-2.4a7.5 7.5 0 0 0 1.9-1.1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1.1Z" />,
    accent: "from-cyan-500/20 to-cyan-500/0 text-cyan-300",
    commands: [
      ["/settings", "Overview of every server configuration"],
      ["/logs", "Set or clear moderation, ticket and activity logs"],
      ["/automod", "Configure invite, link, word, caps and spam filters"],
    ],
  },
  {
    name: "Utility",
    icon: <path d="M12 3v18M3 12h18M7.5 7.5l9 9M16.5 7.5l-9 9" />,
    accent: "from-amber-500/20 to-amber-500/0 text-amber-300",
    commands: [
      ["/ping", "Check bot latency"],
      ["/help", "Display all commands"],
      ["/invite", "Get bot invite link"],
      ["/stats", "View bot statistics"],
      ["/userinfo", "Show information about a member"],
      ["/serverinfo", "Show information about the server"],
      ["/avatar", "Show a member avatar"],
      ["/banner", "Show a member profile banner"],
      ["/membercount", "Count members, bots and online users"],
      ["/botinfo", "Show bot uptime, memory and latency"],
      ["/roleinfo", "Show details and permissions of a role"],
      ["/channelinfo", "Show details about a channel"],
      ["/poll", "Create a five-option reaction poll"],
      ["/say", "Send a plain message as the bot"],
      ["/embed", "Send a custom embed"],
    ],
  },
  {
    name: "Advanced",
    icon: <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm3 0 2 2 4-4" />,
    accent: "from-violet-500/20 to-violet-500/0 text-violet-300",
    commands: [
      ["/rolerequest", "Submit a whitelist application with voucher"],
      ["/announcement", "Post a styled announcement to a channel"],
    ],
  },
];

const FAQS = (name: string) => [
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
    a: `${name} listens to Discord presence updates and announces Kick or TikTok streams when Discord reports a streaming activity with a matching platform URL. No streaming API is used; Discord may not expose these URLs for every streamer.`,
  },
  {
    q: "Can I manage everything from the website?",
    a: "Yes. Sign in with Discord, pick a server where you have the Manage Server permission and configure auto-mod, welcome messages, roles, tickets and notifications.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p
        className={`eyebrow ${align === "center" ? "justify-center [&::before]:hidden" : ""}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">{description}</p>
      )}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;
  const requestHeaders = await headers();
  const redirectUri = getOAuthRedirectUri(getAppUrlForHeaders(requestHeaders));
  const failureHint =
    reason === "token_exchange"
      ? "Discord rejected the sign-in code. This almost always means the redirect URL below is not listed exactly like that in the Discord Developer Portal."
      : reason === "profile"
        ? "Discord accepted the sign-in but did not return your profile. Please try again."
        : reason === "session"
          ? "Your Discord account is fine, but the website could not save the session. Check the database configuration (DATABASE_URL) and its migrations."
          : "Check that the OAuth2 redirect URL in the Discord Developer Portal exactly matches the URL below, then try again.";
  const [user, guildCount, caseCount, ticketCount] = await Promise.all([
    getSessionUser(),
    prisma.guild.count().catch(() => 0),
    prisma.case.count().catch(() => 0),
    prisma.ticket.count().catch(() => 0),
  ]);

  const stats = [
    { label: "Servers protected", value: guildCount.toLocaleString("en-US"), hint: "live instances" },
    { label: "Moderation cases", value: caseCount.toLocaleString("en-US"), hint: "actions logged" },
    { label: "Tickets handled", value: ticketCount.toLocaleString("en-US"), hint: "conversations" },
    { label: "Uptime", value: "99.9%", hint: "last 30 days" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader signedIn={Boolean(user)} inviteHref={inviteUrl()} />

      <main className="page-enter flex-1 overflow-hidden">
        {error && (
          <div
            role="alert"
            className="mx-auto mt-6 w-full max-w-3xl px-4 sm:px-6"
          >
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-5 py-4 text-sm text-rose-200 backdrop-blur-xl">
              {error === "oauth_denied" ? (
                "Discord sign-in was cancelled. Try again and approve the requested access."
              ) : error === "oauth_state" ? (
                "Sign-in expired or could not be verified. Please try again."
              ) : error === "session_expired" ? (
                "Your Discord session expired. Sign in again to keep managing your servers."
              ) : (
                <>
                  <p>Discord sign-in failed. {failureHint}</p>
                  <p className="mt-2 text-rose-200/80">
                    Required redirect URL:{" "}
                    <code className="break-all rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-xs">
                      {redirectUri}
                    </code>
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Hero */}
        <section className="relative px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
          <div
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[34rem] w-[min(90rem,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.14),rgba(99,102,241,0.12)_45%,transparent_75%)] blur-2xl"
            aria-hidden="true"
          />

          <div className="mx-auto max-w-5xl text-center">
            <div className="mx-auto inline-flex items-center gap-2.5 rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 shadow-lg shadow-cyan-500/5 sm:text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Next-gen Discord security system
              <span className="hidden h-3 w-px bg-cyan-300/25 sm:block" />
              <span className="hidden font-mono text-[10px] font-normal tracking-normal text-cyan-300/70 sm:block">
                v2.0
              </span>
            </div>

            <h1 className="mx-auto mt-7 max-w-5xl text-[clamp(2.15rem,10vw,2.65rem)] font-bold leading-[1.02] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
              <span className="block">Command Your</span>
              <span className="text-gradient text-shadow-glow mt-1 block pb-1">Digital Realm</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300/90 sm:mt-7 sm:text-lg lg:text-xl">
              {WEBSITE_DESCRIPTION}
            </p>

            <div className="mx-auto mt-9 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <a
                href={inviteUrl()}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 via-brand-600 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-500/40"
              >
                <span className="relative z-10">Deploy {WEBSITE_NAME}</span>
                <svg viewBox="0 0 24 24" className="relative z-10 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </a>
              <Link
                href="/dashboard"
                className="btn btn-ghost group px-7 py-3.5"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md border border-white/15 bg-white/5" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-sm bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                </span>
                Access Command Center
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-slate-500 sm:text-xs">
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m4 12 5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m4 12 5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Self-hosted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m4 12 5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Ready in minutes
              </span>
            </div>
          </div>

          <HeroConsole />

          <dl className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:mt-16 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-white/[0.07] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-white/[0.08] sm:bg-white/[0.02] sm:backdrop-blur-xl">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-5 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-6 sm:py-7"
              >
                <div
                  className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                  aria-hidden="true"
                />
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                  {stat.label}
                </dt>
                <dd className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {stat.value}
                </dd>
                <p className="mt-1 text-[10px] text-cyan-300/60 sm:text-[11px]">{stat.hint}</p>
              </div>
            ))}
          </dl>
        </section>

        {/* Features */}
        <section id="features" className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Core modules"
                title={
                  <>
                    Everything a busy
                    <span className="text-gradient-soft"> community needs</span>
                  </>
                }
                description={`${WEBSITE_NAME} covers the repetitive work so your moderators can focus on the humans.`}
              />
              <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-slate-400 sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Six modules online
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.title}
                  className="group surface-panel hover-lift relative overflow-hidden rounded-2xl p-5 sm:p-6"
                >
                  <div
                    className={`pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full blur-3xl transition-opacity duration-500 ${feature.glow} opacity-0 group-hover:opacity-100`}
                  />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.accent} ring-1 ring-white/10`}>
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
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="relative mt-5 text-base font-semibold text-white">{feature.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-400">{feature.description}</p>
                  <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <span className="font-mono text-[10px] text-slate-600">
                      MODULE / 0{index + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-300/70">
                      Active
                      <span className="h-1 w-1 rounded-full bg-emerald-400" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="relative border-y border-white/[0.06] bg-[#06060f]/45 py-20 sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Deployment sequence"
              title={
                <>
                  Live in under <span className="text-gradient">two minutes</span>
                </>
              }
              description="No servers to manage, no config files to wrestle. Connect Discord, choose your channels, and the system takes over."
              align="center"
            />

            <ol className="relative mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
              <div
                className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-10 hidden h-px bg-gradient-to-r from-cyan-400/0 via-brand-400/40 to-violet-400/0 md:block"
                aria-hidden="true"
              />
              {STEPS.map((item) => (
                <li
                  key={item.step}
                  className="surface-panel relative rounded-2xl p-6 sm:p-7"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] font-mono text-sm font-semibold text-cyan-200 shadow-[0_0_28px_-12px_rgba(34,211,238,0.8)]">
                      {item.step}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Commands */}
        <section id="commands" className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <SectionHeading
              eyebrow="Slash command arsenal"
              title={
                <>
                  Full control, <span className="text-gradient">one command away</span>
                </>
              }
              description={
                <>
                  Every command you can run with{" "}
                  <code className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-300">
                    /help
                  </code>{" "}
                  in Discord — fast, precise and available straight from your server.
                </>
              }
              align="center"
            />

            <div className="mt-10 grid gap-4 sm:mt-14 md:grid-cols-2 xl:grid-cols-3">
              {COMMAND_GROUPS.map((group) => (
                <article
                  key={group.name}
                  className="group surface-panel relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/25 hover:shadow-2xl hover:shadow-cyan-500/10 sm:p-6"
                >
                  <div
                    className={`pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-gradient-to-br opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100 ${group.accent}`}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${group.accent} ring-1 ring-white/10`}>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          {group.icon}
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-white">{group.name}</h3>
                    </div>
                    <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-slate-500">
                      {group.commands.length}
                    </span>
                  </div>
                  <ul className="relative mt-5 space-y-2">
                    {group.commands.map(([name, description]) => (
                      <li
                        key={name}
                        className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-cyan-400/20 hover:bg-cyan-400/[0.045]"
                      >
                        <code className="font-mono text-xs font-medium text-cyan-300 sm:text-sm">
                          {name}
                        </code>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                          {description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="relative border-t border-white/[0.06] bg-[#06060f]/45 py-20 sm:py-24">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Knowledge base"
              title="Frequently asked questions"
              align="center"
            />

            <div className="mt-10 space-y-3">
              {FAQS(WEBSITE_NAME).map((item, index) => (
                <details
                  key={item.q}
                  className="group surface-panel overflow-hidden rounded-xl px-5 py-4 open:border-cyan-400/20 sm:px-6 sm:py-5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-white">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-slate-600">0{index + 1}</span>
                      {item.q}
                    </span>
                    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-400 transition duration-300 group-open:rotate-45 group-open:border-cyan-400/30 group-open:bg-cyan-400/10 group-open:text-cyan-200">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-3xl pl-8 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="glow relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-600/15 via-[#0a0a16] to-[#07070f] px-5 py-14 text-center sm:rounded-[2rem] sm:px-10 sm:py-20">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.16),rgba(99,102,241,0.12)_55%,transparent)] blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04] sm:h-[34rem] sm:w-[34rem]"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[18rem] w-[18rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-400/10 sm:h-[24rem] sm:w-[24rem]"
              aria-hidden="true"
            />
            <p className="eyebrow justify-center [&::before]:hidden">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              Ready when you are
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              <span className="text-gradient">{APP_TAGLINE}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-lg">
              Free to use, self hosted and configured in minutes.
            </p>
            <div className="mx-auto mt-9 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center">
              <a
                href={inviteUrl()}
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 via-brand-600 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-cyan-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-500/40"
              >
                <span className="relative z-10">Initialize {WEBSITE_NAME}</span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </a>
              <Link href="/dashboard" className="btn btn-ghost px-7 py-3.5">
                Open Command Center
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] bg-[#05050c]/70">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 via-brand-500 to-violet-600 shadow-lg shadow-brand-600/25">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" aria-hidden="true">
                    <path
                      d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.9 7.5 10.2 4.4-1.3 7.5-5.6 7.5-10.2V5.6L12 2.5Z"
                      fill="currentColor"
                      fillOpacity="0.16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path d="m8.8 11.9 2.3 2.3 4.3-4.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-base font-semibold text-white">{WEBSITE_NAME}</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
                A modern Discord guardian for moderation, onboarding, support and live alerts. Built
                with discord.js, Next.js and Prisma.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[10px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                All systems operational
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Explore
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><a href="#features" className="transition hover:text-white">Features</a></li>
                <li><a href="#commands" className="transition hover:text-white">Commands</a></li>
                <li><a href="#faq" className="transition hover:text-white">FAQ</a></li>
                <li><Link href="/dashboard" className="transition hover:text-white">Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Get started
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                <li><a href={inviteUrl()} className="transition hover:text-white">Add to Discord</a></li>
                <li><Link href="/api/auth/login" className="transition hover:text-white">Sign in with Discord</Link></li>
                <li><Link href="/dashboard" className="transition hover:text-white">Command Center</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-center text-xs text-slate-600 sm:flex-row sm:text-left">
            <p>
              © {new Date().getFullYear()} {WEBSITE_NAME}. Not affiliated with Discord Inc.
            </p>
            <p className="font-mono text-[10px] tracking-wider text-slate-700">
              BUILD / NEXUS-2.0
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
