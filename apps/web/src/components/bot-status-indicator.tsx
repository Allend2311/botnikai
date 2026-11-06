"use client";

import { useEffect, useState } from "react";

type Status = "online" | "offline" | "unavailable";

export function BotStatusIndicator({ initialOnline }: { initialOnline: boolean }) {
  const [status, setStatus] = useState<Status>(initialOnline ? "online" : "offline");

  useEffect(() => {
    let active = true;
    const refreshStatus = async () => {
      try {
        const response = await fetch("/api/bot-status", { cache: "no-store" });
        if (!response.ok) throw new Error(`Status request failed with ${response.status}.`);
        const result: unknown = await response.json();
        if (
          typeof result !== "object" ||
          result === null ||
          !("online" in result) ||
          typeof result.online !== "boolean"
        ) {
          throw new Error("Status response was invalid.");
        }
        if (active) setStatus(result.online ? "online" : "offline");
      } catch {
        if (active) setStatus("unavailable");
      }
    };

    void refreshStatus();
    const intervalId = window.setInterval(() => void refreshStatus(), 20_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const label = status === "online" ? "Bot online" : status === "offline" ? "Bot offline" : "Status unavailable";
  const dotClass =
    status === "online"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
      : status === "offline"
        ? "bg-rose-400"
        : "bg-amber-400";

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[10px] font-medium text-slate-300 sm:gap-2 sm:px-2.5 sm:text-xs"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{status === "unavailable" ? "?" : status === "online" ? "Online" : "Offline"}</span>
    </span>
  );
}
