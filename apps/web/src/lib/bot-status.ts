export const BOT_STATUS_STALE_AFTER_MS = 90_000;

export function isBotOnline(
  status: { online: boolean; lastHeartbeatAt: Date | null } | null,
  now = Date.now(),
): boolean {
  if (!status?.online || !status.lastHeartbeatAt) return false;
  const age = now - status.lastHeartbeatAt.getTime();
  return age >= 0 && age <= BOT_STATUS_STALE_AFTER_MS;
}
