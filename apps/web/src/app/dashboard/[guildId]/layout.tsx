import { notFound } from "next/navigation";
import { getGuildContext } from "@/lib/guild";
import { guildIconUrl, inviteUrl } from "@/lib/discord";
import { getSession } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";
import { DashboardChrome } from "@/components/dashboard-chrome";
import { prisma } from "@/lib/prisma";
import { isBotOnline } from "@/lib/bot-status";

export const dynamic = "force-dynamic";

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const [context, session] = await Promise.all([getGuildContext(guildId), getSession()]);

  if (!context || !session) notFound();

  const icon = guildIconUrl(context.guild.id, context.guild.icon);
  const avatar = avatarUrl(session.user.discordId, session.user.avatar);
  const displayName = session.user.globalName ?? session.user.username;
  const botStatus = await prisma.botStatus.findUnique({ where: { id: "primary" } });
  return (
    <DashboardChrome
      guildId={guildId}
      guildName={context.guild.name}
      guildIcon={icon}
      memberCount={context.guild.approximate_member_count ?? 0}
      canManage={context.canManage}
      botOnline={isBotOnline(botStatus)}
      displayName={displayName}
      avatar={avatar}
      initials={session.user.username.slice(0, 2).toUpperCase()}
      inviteHref={inviteUrl()}
    >
      {children}
    </DashboardChrome>
  );
}
