ALTER TABLE "GuildSettings"
ADD COLUMN "roleRequestRoleId" TEXT;

CREATE TABLE "RoleRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "inGameName" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "voucherName" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VOUCH',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoleRequest_guildId_status_createdAt_idx"
ON "RoleRequest"("guildId", "status", "createdAt");

CREATE INDEX "RoleRequest_guildId_applicantId_status_idx"
ON "RoleRequest"("guildId", "applicantId", "status");
