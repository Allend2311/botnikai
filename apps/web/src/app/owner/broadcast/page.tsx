import Link from "next/link";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { loadBroadcastTargets, type BroadcastTarget } from "@/lib/broadcast";
import { getSessionUser } from "@/lib/session";
import { BroadcastConsole } from "./broadcast-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OwnerBroadcastPage() {
  const user = await getSessionUser();

  let targets: BroadcastTarget[] = [];
  let loadError = "";

  try {
    targets = await loadBroadcastTargets();
  } catch (error) {
    console.error("[owner/broadcast] could not load the bot's servers:", error);
    loadError = "Could not load the bot's servers from Discord. Refresh the page to try again.";
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="border-b border-white/[0.06] bg-[#05050d]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Logo showTagline={false} />
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/dashboard" className="btn btn-ghost px-3 py-2 text-xs">
                Dashboard
              </Link>
              {user && (
                <span className="hidden max-w-[10rem] truncate text-xs font-medium text-slate-400 sm:block">
                  {user.globalName ?? user.username}
                </span>
              )}
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="page-enter mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <PageHeader
          eyebrow="Owner tools"
          title={
            <>
              Broadcast <span className="text-gradient-soft">update</span>
            </>
          }
          description="Preview an update, then send it to every server the bot is in. Channels are detected automatically and servers without an announcement channel are skipped."
          action={
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.9)]" />
              Owner only
            </span>
          }
        />

        <div className="mt-8">
          {loadError ? (
            <Card title="Discord is unreachable">
              <p className="text-sm leading-relaxed text-slate-400">{loadError}</p>
            </Card>
          ) : (
            <BroadcastConsole targets={targets} />
          )}
        </div>
      </main>
    </div>
  );
}
