CREATE TABLE "ScheduledMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "embedTitle" TEXT,
    "embedDescription" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageAutomation" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "channelId" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "embedTitle" TEXT,
    "embedDescription" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageAutomation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StickyMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "embedTitle" TEXT,
    "embedDescription" TEXT,
    "messageId" TEXT,
    "autoUpdate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickyMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotStatus" (
    "id" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "lastHeartbeatAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotStatus_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledMessage_status_scheduledAt_idx" ON "ScheduledMessage"("status", "scheduledAt");
CREATE INDEX "ScheduledMessage_guildId_scheduledAt_idx" ON "ScheduledMessage"("guildId", "scheduledAt");
CREATE UNIQUE INDEX "MessageAutomation_guildId_templateId_trigger_key" ON "MessageAutomation"("guildId", "templateId", "trigger");
CREATE INDEX "MessageAutomation_guildId_enabled_idx" ON "MessageAutomation"("guildId", "enabled");
CREATE UNIQUE INDEX "StickyMessage_channelId_key" ON "StickyMessage"("channelId");
CREATE INDEX "StickyMessage_guildId_idx" ON "StickyMessage"("guildId");
