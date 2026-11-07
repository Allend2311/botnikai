import Link from "next/link";
import { DiscordApiError, discordRequest } from "@/lib/discord";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

interface BotProfile {
  id: string;
  username: string;
  avatar: string | null;
}

export default async function OwnerProfilePage() {
  const user = await getSessionUser();
  let profile: BotProfile | null = null;
  let loadError = "";

  try {
    profile = await discordRequest<BotProfile>("/users/@me");
  } catch (error) {
    console.error("[owner/profile] could not load the bot profile:", error);
    loadError = error instanceof DiscordApiError && error.status === 401
      ? "Discord rejected the bot token. Check DISCORD_TOKEN in the website deployment settings."
      : "Could not load the bot profile from Discord. Check the bot token and try again.";
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40">
        <div className="border-b border-white/[0.06] bg-[#05050d]/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Logo showTagline={false} />
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/owner/broadcast" className="btn btn-ghost px-3 py-2 text-xs">
                Broadcast
              </Link>
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
          title={<>Bot <span className="text-gradient-soft">profile</span></>}
          description="Update the name and picture shown on the bot's Discord account."
          action={
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
              Owner only
            </span>
          }
        />

        <div className="mt-8">
          {profile ? (
            <ProfileForm initialProfile={profile} />
          ) : (
            <Card title="Discord is unreachable">
              <p className="text-sm leading-relaxed text-slate-400">{loadError}</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
