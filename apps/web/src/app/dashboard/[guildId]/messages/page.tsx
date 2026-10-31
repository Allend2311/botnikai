import { notFound } from "next/navigation";
import { MessageTemplates } from "@/components/message-templates";
import { getGuildContext, textChannels } from "@/lib/guild";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const context = await getGuildContext(guildId);
  if (!context) notFound();

  const templates = await prisma.messageTemplate.findMany({
    where: { guildId },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <MessageTemplates
      guildId={guildId}
      guildName={context.guild.name}
      templates={templates.map((template) => ({
        ...template,
        updatedAt: template.updatedAt.toISOString(),
      }))}
      channels={textChannels(context.channels).map((channel) => ({
        value: channel.id,
        label: `#${channel.name}`,
      }))}
      canManage={context.canManage}
    />
  );
}
