# GuardBot

A Discord bot with a companion web dashboard — moderation, welcome & roles, a ticket
system, Kick/TikTok live pings and Discord post notifications, all configurable from a website.

Built as an npm-workspaces monorepo with **discord.js**, **Next.js 15** and **Prisma**.
The database is **Prisma Postgres** — the bot and the dashboard share it.

---

## Features

| Module | What it does |
| --- | --- |
| **Moderation** | `/ban` `/kick` `/mute` `/warn` `/purge` `/lock` `/slowmode`, case history, warning tracking and a mod-log channel. |
| **Auto-moderation** | Blocks Discord invites, external links (with domain allow-list), spam, excessive caps and banned words. Per-rule actions, per-channel/role ignores. |
| **Welcome & roles** | Custom welcome and farewell messages with template tokens, uploaded image/GIF embeds and DMs, automatic auto-roles and emoji reaction roles. |
| **Tickets** | Support panels posted by the bot, private ticket channels, support roles, transcripts and a ticket history. |
| **Role requests** | Any server member can post an in-game name and nominate a voucher. Requests and review cards stay in the submitting server channel; the bot does not DM applicants or vouchers. |
| **Announcements** | Administrators can post styled announcements with an optional image or GIF and optional `@everyone` / `@here` pings using `/announcement send`. |
| **Kick & TikTok live pings** | Uses Discord presence updates to announce matching Kick/TikTok streaming activities and ping a configured role; no platform API is used. |
| **New post notifications** | Reposts new Discord forum/channel posts into an announcement channel. External-platform videos are not monitored. |
| **Dashboard** | Discord OAuth2 login, server picker, and pages for every setting — no need to touch Discord commands. |

---

## Project structure

```
.
├── apps/
│   ├── bot/            # discord.js bot (TypeScript, CommonJS)
│   │   ├── src/
│   │   │   ├── commands/    # slash commands
│   │   │   ├── events/      # gateway events
│   │   │   ├── services/    # business logic (moderation, tickets, live, …)
│   │   │   └── lib/         # db, settings, embeds, permissions, logger
│   │   └── deploy-commands.ts
│   └── web/            # Next.js 15 App Router dashboard + landing page
│       └── src/
│           ├── app/
│           │   ├── page.tsx             # landing page
│           │   ├── api/auth/            # OAuth2 login / callback / logout
│           │   ├── dashboard/           # server picker + settings pages
│           │   └── actions.ts           # server actions (all mutations)
│           ├── components/  # UI primitives
│           └── lib/         # prisma, discord REST, session, auth
├── packages/
│   └── shared/         # constants, template + formatting helpers
├── prisma/
│   ├── schema.prisma   # data model (PostgreSQL)
│   ├── migrations/     # checked-in SQL migrations
│   └── seed.ts
├── prisma.config.ts    # Prisma CLI configuration
└── docker-compose.yml
```

---

## Prerequisites

- Node.js 20+ (developed on Node 22)
- npm 10+
- A Discord application with a bot user
- A [Prisma Postgres](https://www.prisma.io/postgres) project

---

## 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and
   create a **New Application**.
2. On **General Information** copy the **Application ID** → `DISCORD_CLIENT_ID` /
   `DISCORD_APPLICATION_ID`.
3. Open **Bot** → **Reset Token** and copy the token → `DISCORD_TOKEN`.
4. Open **OAuth2 → General** and add the redirect URL:
   ```
   http://localhost:3000/api/auth/callback
   ```
   It must exactly match `APP_URL` followed by `/api/auth/callback` (use your
   deployed website's URL in production). Copy the **Client Secret** →
   `DISCORD_CLIENT_SECRET`.
5. Open **Bot → Privileged Gateway Intents** and enable:
   - **Server Members Intent** (welcome messages, auto-roles)
   - **Server Presence Intent** (live/streaming detection)
   - **Message Content Intent** (auto-moderation)

   > Without these three intents the bot still runs, but welcome messages, live
   > announcements and auto-moderation stay silent.

6. Make the bot invitable by everyone:
   - **Bot → Public Bot** must be **enabled** (Authorization Flow). While it is off,
     only you / your team can invite the bot, which looks like the bot being stuck
     in one server.
   - **Installation → Guild Install** must be enabled with the `bot` and
     `applications.commands` scopes; the dashboard generates exactly that link.
   - The **Add to Discord** buttons deliberately do *not* include a `guild_id`, so
     Discord lets the visitor pick any server they manage. The cards in the
     dashboard pre-select the server you clicked.

   > Unverified bots can join up to 100 servers. Beyond that Discord requires
   > verification, but there is no code-side limit in this project.

7. Optional: open **OAuth2 → URL Generator**, tick `bot` and
   `applications.commands`, and copy the generated invite link. The dashboard uses the
   same permissions automatically.

---

## 2. Create the Prisma Postgres database

1. Create a project at [Prisma Postgres](https://www.prisma.io/postgres).
2. Copy the PostgreSQL connection string from the project's connection details
   into `DATABASE_URL` in `.env`.
3. Set `DIRECT_URL` to the direct connection string if your project provides one
   for migrations. If it does not, this project can use the same pooled URL for
   both values.

---

## 3. Install and configure

```bash
npm install
cp .env.example .env    # then fill in your values
```

`.env`:

```dotenv
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_APPLICATION_ID=...

DATABASE_URL="postgres://USER:PASSWORD@pooled.db.prisma.io:5432/postgres?sslmode=require"
DIRECT_URL="${DATABASE_URL}"       # use a direct URL here if your project provides one

APP_URL=http://localhost:3000
```

Keep connection strings private. Verify the connection with `npm run db:check`.

---

## 4. Apply the migrations and register the commands

```bash
npm run db:generate   # generate the Prisma client
npm run db:deploy     # apply prisma/migrations to Prisma Postgres
npm run deploy:commands
```

`db:deploy` runs `prisma migrate deploy`, which creates every table (`User`, `Session`,
`Guild`, `GuildSettings`, `AutomodConfig`, `ReactionRole`, `Warning`, `Case`, `LogEntry`,
`CommandStat`, `MessageTemplate`, `TicketPanel`, `Ticket`, `TicketTranscript`) and the
`_prisma_migrations` history table. It is safe to run it again — already applied
migrations are skipped.

The bot registers every slash command globally when it starts and automatically
registers a server-specific copy in every server it has joined. When invited to another
server, it registers commands there automatically; no server IDs need to be configured.
Only that server's Administrators can use the commands. You can also run
`npm run deploy:commands` to register the global commands manually.

---

## 5. Keep the Discord bot online with Render

A bot running only on your PC stops when that PC is off. To keep the bot online,
deploy the bot as an always-on Render background worker. This repository's
`render.yaml` defines the worker as `kai-bot`; the bot still requires the hosted
PostgreSQL database created above.

1. Push the project to GitHub.
2. In Render, choose **New → Blueprint**, connect the repository, and let Render read
   `render.yaml` to create the `kai-bot` worker.
   Choose a worker plan that stays running rather than one that spins down.
3. Enter the environment variables requested by the Blueprint:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_APPLICATION_ID`
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `APP_URL` — the public dashboard URL if you have one. This is used for dashboard
     links shown by bot commands; it does not host or run the dashboard.
4. Apply any pending database migrations once with `npm run db:deploy` from the
   repository root, using a local `.env` configured for the same hosted database.
   Keep `.env` and all credentials out of GitHub.
5. Deploy the worker. Render builds the bot and starts it using the commands in
   `render.yaml`. Check the worker logs for a successful Discord login.

The worker continues running when your PC is off. To apply bot code changes, push
them to the connected GitHub repository and let Render redeploy the worker.

Bot and database scripts:

| Command | Description |
| --- | --- |
| `npm run build:shared` | Build the shared package required by the bot |
| `npm run build:bot` | Build the bot |
| `npm run start:bot` | Run the built bot |
| `npm run deploy:commands` | Register Discord slash commands |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:check` | Test the connection and list the existing tables |
| `npm run db:deploy` | Apply the checked-in migrations |
| `npm run db:status` | Show which migrations are applied |
| `npm run db:migrate` | Create a new migration (needs a local PostgreSQL) |

---

## 6. Use the dashboard

1. Open the website and click **Sign in** — you are redirected to Discord for OAuth2
   (`identify guilds guilds.members.read`).
2. Pick a server. Only servers where the bot is installed **and** where you have the
   **Manage Server** permission are listed.
3. Configure auto-moderation, welcome messages, roles, tickets and notifications.
   Every change is written to the same database the bot reads, so it takes effect
   immediately.
   Under **Messages → Templates**, create and save reusable text/embed messages, preview
   them, and send a saved template to a selected text channel. Schedule, Automate, Sticky,
   and message components are not available yet.
4. For Kick/TikTok live announcements, enable the Server Presence and Server Members
   intents in the Discord Developer Portal, enable **Live announcements**, and choose
   the announcement channel and any combination of role, `@everyone`, or `@here` pings.
   The bot needs Discord's **Mention @everyone, @here, and All Roles** permission in the
   announcement channel for broadcast mentions. Add the exact Kick/TikTok profile usernames
   under **Streaming accounts**. The bot announces a live activity only when Discord
   provides a Streaming URL whose username matches one of those accounts. It does not
   query either platform's API, and Discord may not expose activity URLs for every
   streamer. Latest Kick/TikTok posts are not monitored in this API-free mode.

> The dashboard and the bot share one database — that is why the website can change
> bot behaviour without restarting it.

---

## Slash commands

**Moderation** — `/ban` `/unban` `/kick` `/mute` `/unmute` `/warn` `/warnings` `/removewarn`
`/purge` `/lock` `/unlock` `/slowmode` `/modlogs` `/userinfo`

**Setup** — `/welcome` `/goodbye` `/autorole` `/reactionrole` `/ticketpanel`
`/ticket` (create · close · rename · list) `/liveconfig` `/livecheck` `/postconfig` `/posttest`

**Role requests & announcements** — `/rolerequest submit`
`/announcement send`

**Utility** — `/help` `/ping` `/stats` `/invite`

Slash commands are available in every server where the bot is installed. Only
members with the Discord **Administrator** permission in that server can use
administrative commands; `/rolerequest submit` is available to all server members.
After changing or deploying command permissions, run `npm run deploy:commands` to
update Discord's registered global commands. Global command updates can take up to
an hour to appear.

Configure dashboard settings or use the matching slash commands where available.
Use `/liveconfig everyone` and `/liveconfig here`, or `/postconfig everyone` and
`/postconfig here`, to enable or disable broadcast mentions in automatic announcements.
`/announcement send` also has optional `ping-everyone` and `ping-here` options.
The dashboard's **Messages** page is a coming-soon overview of the planned message tools.
The nominated voucher must confirm each role request before an Administrator can
review it. The bot posts a review card in the channel where the request was
submitted, and does not DM the applicant or voucher. An Administrator can approve
and choose a role there, or review it in the **Role Requests** dashboard page.
When approved, the applicant receives the selected role and their server nickname
is changed to the submitted in-game name (maximum 32 characters). The bot needs
Manage Nicknames permission and a role position above the applicant. Make that
channel visible to the server Administrators. Manage community streaming profile links in
**Notifications**; automatic live alerts respond to Discord streaming activities,
not external platform status.
Set welcome and farewell image/GIF URLs from the dashboard, or with
`/welcome image` and `/goodbye image`. Use a publicly accessible HTTPS image URL;
leave the slash-command URL empty to clear an image.

Welcome and farewell images uploaded from your device are stored in the
configured PostgreSQL database. No Supabase Storage bucket or service-role key
is required. Uploads accept PNG, JPEG, WebP and GIF files up to 8 MB. Set
`APP_URL` to the website's public HTTPS address in production so Discord can
load uploaded images in embeds.

---

## Changing the database schema

Migrations are plain SQL files in `prisma/migrations` and are applied with
`npm run db:deploy`. To create a new one you need a PostgreSQL instance that can
create a **shadow database**. If your hosted database does not allow that, run a
local one:

```bash
docker compose --profile postgres up -d postgres
```

```dotenv
# temporarily point Prisma at the local instance
DATABASE_URL="postgresql://guardbot:guardbot@localhost:5432/guardbot?schema=public"
DIRECT_URL="postgresql://guardbot:guardbot@localhost:5432/guardbot?schema=public"
```

```bash
npm run db:migrate -- --name describe_your_change
```

Commit the generated folder in `prisma/migrations` and run `npm run db:deploy` against
Prisma Postgres again.

---

## Docker

```bash
docker build -t guardbot .
docker compose up -d
```

The container applies the pending migrations (`prisma migrate deploy`) before it starts
the bot and the website, and reads the database connection strings from `.env`.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Welcome messages or live pings never arrive | Enable the **Server Members** and **Server Presence** intents in the developer portal. |
| Auto-moderation ignores messages | Enable the **Message Content** intent. |
| "Manage Server" error in the dashboard | The bot cannot see your member permissions — make sure it is in the server with the `Manage Server` permission, and that you signed in with an account that has it. |
| Slash commands do not appear | Restart the bot and check for `Commands registered in guild <ID>` in its logs. Confirm the bot is installed in the server with `applications.commands` and the user has Administrator permission there. |
| Bot only works in one server | Commands used to be registered as guild-only. Run `npm run deploy:commands` again (it now also registers global commands), then check **Bot → Public Bot** in the developer portal. |
| `Environment variable not found: DATABASE_URL` | Create `.env` in the repository root (not inside `apps/*`). |
| OAuth2 redirect error | The redirect URL in the developer portal must exactly match `APP_URL` + `/api/auth/callback`. Open the landing page after a failed sign-in — it prints the exact URL the site is using. `APP_URL` must be set in Netlify's environment variables (the local `.env` is not deployed) and must not end with `/`. |
| `P1001: Can't reach database server` | Check the host and port in `DATABASE_URL`, then check your network connection. |
| `P1010: User was denied access on the database` | Check the username and password in the connection string and confirm they match the database project. |
| Migration connection errors | Set `DIRECT_URL` to a direct connection string if your database provider supplies one. |

---

## License

MIT — not affiliated with Discord Inc.
