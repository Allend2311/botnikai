-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "ownerId" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL,
    "modLogChannelId" TEXT,
    "ticketLogChannelId" TEXT,
    "activityLogChannelId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Welcome {user} to {server}! You are member #{membercount}.',
    "welcomeDmMessage" TEXT,
    "dmOnJoin" BOOLEAN NOT NULL DEFAULT false,
    "autoRoleIds" TEXT NOT NULL DEFAULT '[]',
    "goodbyeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "goodbyeChannelId" TEXT,
    "goodbyeMessage" TEXT NOT NULL DEFAULT '{user} just left the server.',
    "liveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "liveChannelId" TEXT,
    "liveRoleId" TEXT,
    "liveMode" TEXT NOT NULL DEFAULT 'both',
    "liveAnnounceEnd" BOOLEAN NOT NULL DEFAULT false,
    "liveIncludeUrl" BOOLEAN NOT NULL DEFAULT true,
    "postEnabled" BOOLEAN NOT NULL DEFAULT false,
    "postForumChannelId" TEXT,
    "postWatchChannelId" TEXT,
    "postChannelId" TEXT,
    "postRoleId" TEXT,
    "postPingAuthor" BOOLEAN NOT NULL DEFAULT true,
    "postIncludeContent" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "AutomodConfig" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "blockInvites" BOOLEAN NOT NULL DEFAULT true,
    "blockExternalLinks" BOOLEAN NOT NULL DEFAULT false,
    "allowedDomains" TEXT NOT NULL DEFAULT '[]',
    "maxCapsPercent" INTEGER NOT NULL DEFAULT 50,
    "blockCaps" BOOLEAN NOT NULL DEFAULT false,
    "spamMaxMessages" INTEGER NOT NULL DEFAULT 5,
    "spamWindowSeconds" INTEGER NOT NULL DEFAULT 7,
    "bannedWords" TEXT NOT NULL DEFAULT '[]',
    "ignoreChannels" TEXT NOT NULL DEFAULT '[]',
    "ignoreRoles" TEXT NOT NULL DEFAULT '[]',
    "actionLink" TEXT NOT NULL DEFAULT 'DELETE',
    "actionSpam" TEXT NOT NULL DEFAULT 'DELETE',
    "actionWord" TEXT NOT NULL DEFAULT 'DELETE',
    "actionCaps" TEXT NOT NULL DEFAULT 'DELETE',
    "warnLimit" INTEGER NOT NULL DEFAULT 3,
    "timeoutMinutes" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomodConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "ReactionRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetTag" TEXT,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "durationMs" INTEGER,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandStat" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommandStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPanel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "supportRoleId" TEXT,
    "maxOpenPerUser" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "panelId" TEXT,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTranscript" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "ReactionRole_guildId_channelId_idx" ON "ReactionRole"("guildId", "channelId");

-- CreateIndex
CREATE INDEX "Warning_guildId_userId_idx" ON "Warning"("guildId", "userId");

-- CreateIndex
CREATE INDEX "Case_guildId_createdAt_idx" ON "Case"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Case_guildId_caseNumber_key" ON "Case"("guildId", "caseNumber");

-- CreateIndex
CREATE INDEX "LogEntry_guildId_createdAt_idx" ON "LogEntry"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommandStat_guildId_name_key" ON "CommandStat"("guildId", "name");

-- CreateIndex
CREATE INDEX "TicketPanel_guildId_idx" ON "TicketPanel"("guildId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");

-- CreateIndex
CREATE INDEX "Ticket_channelId_idx" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "TicketTranscript_ticketId_idx" ON "TicketTranscript"("ticketId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

