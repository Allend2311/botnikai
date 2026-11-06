import type { Client } from "discord.js";
import { prisma } from "../lib/db";
import { logger } from "../lib/logger";

const BOT_STATUS_ID = "primary";
const HEARTBEAT_INTERVAL_MS = 30_000;
let heartbeatTimer: NodeJS.Timeout | undefined;

export async function setBotOnline(online: boolean): Promise<void> {
  const heartbeatAt = online ? new Date() : null;
  await prisma.botStatus.upsert({
    where: { id: BOT_STATUS_ID },
    create: { id: BOT_STATUS_ID, online, lastHeartbeatAt: heartbeatAt },
    update: online
      ? { online: true, lastHeartbeatAt: heartbeatAt }
      : { online: false },
  });
}

export function startBotHeartbeat(client: Client): void {
  if (heartbeatTimer) return;

  const heartbeat = () => {
    void setBotOnline(client.isReady()).catch((error) =>
      logger.error("status", `Could not update the bot heartbeat: ${(error as Error).message}`, error),
    );
  };
  heartbeat();
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();
}
