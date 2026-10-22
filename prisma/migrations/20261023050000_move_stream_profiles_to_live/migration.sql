ALTER TABLE "RoleRequest"
DROP COLUMN "streamUsername",
DROP COLUMN "streamPlatform";

CREATE TABLE "LiveStreamAccount" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveStreamAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveStreamAccount_guildId_platform_username_key"
ON "LiveStreamAccount"("guildId", "platform", "username");

CREATE INDEX "LiveStreamAccount_guildId_createdAt_idx"
ON "LiveStreamAccount"("guildId", "createdAt");
