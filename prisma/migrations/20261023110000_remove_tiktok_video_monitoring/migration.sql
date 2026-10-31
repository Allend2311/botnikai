ALTER TABLE "LiveStreamAccount"
DROP COLUMN "providerUserId",
DROP COLUMN "accessTokenEncrypted",
DROP COLUMN "refreshTokenEncrypted",
DROP COLUMN "tokenExpiresAt",
DROP COLUMN "refreshTokenExpiresAt",
DROP COLUMN "lastVideoId",
DROP COLUMN "connectionStatus";
