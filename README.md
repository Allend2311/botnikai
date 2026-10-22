# GuardBot

A Discord bot with a companion web dashboard — moderation, welcome & roles, a ticket
system, live/streaming pings and new-post notifications, all configurable from a website.

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
| **Role requests** | Members submit an in-game name and a vouch; the voucher confirms it, then an Administrator reviews the request in the dashboard and can grant the configured role. |
| **Announcements** | Administrators can post styled announcements with an optional image or GIF using `/announcement send`. |
| **Live & streaming pings** | Announces when a member goes live on Twitch, YouTube or Kick and pings a role. |
| **New post notifications** | Reposts new forum threads and channel posts into an announcement channel with a preview and optional ping. |
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

6. Optional but recommended: open **OAuth2 → URL Generator**, tick `bot` and
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
DEV_GUILD_ID=                       # optional: instant command registration while developing

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
`CommandStat`, `TicketPanel`, `Ticket`, `TicketTranscript`) and the `_prisma_migrations`
history table. It is safe to run it again — already applied migrations are skipped.

`deploy:commands` registers every slash command globally. Set `DEV_GUILD_ID` to
register them in one server only (updates instantly instead of taking up to an hour).

---

## 5. Run it

```bash
npm run dev        # bot (tsx watch) + website (next dev) together
```

- Website: <http://localhost:3000>
- Bot: connects to the gateway and appears online in your server

Useful scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Bot + website in watch mode |
| `npm run dev:bot` / `npm run dev:web` | Run only one of them |
| `npm run build` | Build shared package, bot and website |
| `npm run start` | Run the production build of both |
| `npm run typecheck` | Type-check every workspace |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:check` | Test the connection and list the existing tables |
| `npm run db:deploy` | Apply the checked-in migrations |
| `npm run db:status` | Show which migrations are applied |
| `npm run db:migrate` | Create a new migration (needs a local PostgreSQL) |
| `npm run db:push` | Push the schema without a migration (prototype only) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Prepare default settings, clean orphaned rows |
| `npm run deploy:commands` | Register the slash commands |

---

## 6. Use the dashboard

1. Open the website and click **Sign in** — you are redirected to Discord for OAuth2
   (`identify guilds guilds.members.read`).
2. Pick a server. Only servers where the bot is installed **and** where you have the
   **Manage Server** permission are listed.
3. Configure auto-moderation, welcome messages, roles, tickets and notifications.
   Every change is written to the same database the bot reads, so it takes effect
   immediately.

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

Configure dashboard settings or use the matching slash commands where available.
The nominated voucher must confirm each role request before an Administrator can
review it. Administrators select the role to grant on each request in the
**Role Requests** dashboard page. Manage community streaming profile links in
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
| Slash commands do not appear | Run `npm run deploy:commands`; global commands can take up to an hour, use `DEV_GUILD_ID` for instant updates. |
| `Environment variable not found: DATABASE_URL` | Create `.env` in the repository root (not inside `apps/*`). |
| OAuth2 redirect error | The redirect URL in the developer portal must exactly match `APP_URL` + `/api/auth/callback`. |
| `P1001: Can't reach database server` | Check the host and port in `DATABASE_URL`, then check your network connection. |
| `P1010: User was denied access on the database` | Check the username and password in the connection string and confirm they match the database project. |
| Migration connection errors | Set `DIRECT_URL` to a direct connection string if your database provider supplies one. |

---

## License

MIT — not affiliated with Discord Inc.
