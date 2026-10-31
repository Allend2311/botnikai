ALTER TABLE "LiveStreamAccount"
ADD COLUMN "providerUserId" TEXT,
ADD COLUMN "accessTokenEncrypted" TEXT,
ADD COLUMN "refreshTokenEncrypted" TEXT,
ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastVideoId" TEXT,
ADD COLUMN "connectionStatus" TEXT NOT NULL DEFAULT 'UNCONNECTED';
