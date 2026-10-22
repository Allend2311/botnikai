CREATE TABLE "WelcomeImage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WelcomeImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WelcomeImage_guildId_imageType_createdAt_idx"
ON "WelcomeImage"("guildId", "imageType", "createdAt");
