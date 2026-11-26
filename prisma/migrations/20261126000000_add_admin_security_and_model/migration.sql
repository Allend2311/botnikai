-- Owner-only admin: IP history for signed-in users + moderation model data.

CREATE TABLE "IpLoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'USAGE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpLoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationSample" (
    "id" TEXT NOT NULL,
    "guildId" TEXT,
    "label" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AUTOMOD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainedModel" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'multinomial-naive-bayes',
    "labels" TEXT NOT NULL,
    "artifact" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "trainedBy" TEXT,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainedModel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IpLoginEvent_userId_createdAt_idx" ON "IpLoginEvent"("userId", "createdAt");
CREATE INDEX "IpLoginEvent_ip_createdAt_idx" ON "IpLoginEvent"("ip", "createdAt");
CREATE INDEX "ModerationSample_label_createdAt_idx" ON "ModerationSample"("label", "createdAt");

ALTER TABLE "IpLoginEvent" ADD CONSTRAINT "IpLoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
