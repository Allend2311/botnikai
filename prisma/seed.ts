/**
 * Seeds the database with the default settings for every known guild and
 * removes rows that point to a guild or ticket that no longer exists.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const guilds = await prisma.guild.findMany({ select: { id: true } });

  for (const guild of guilds) {
    await prisma.guildSettings.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    await prisma.automodConfig.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });
  }

  const guildIds = guilds.map((guild) => guild.id);

  const staleReactionRoles = await prisma.reactionRole.deleteMany({
    where: guildIds.length > 0 ? { guildId: { notIn: guildIds } } : {},
  });

  const staleTickets = await prisma.ticket.findMany({
    where: guildIds.length > 0 ? { guildId: { notIn: guildIds } } : {},
    select: { id: true },
  });

  await prisma.ticketTranscript.deleteMany({
    where: { ticketId: { in: staleTickets.map((ticket) => ticket.id) } },
  });

  await prisma.ticket.deleteMany({
    where: guildIds.length > 0 ? { guildId: { notIn: guildIds } } : {},
  });

  console.log(
    `[seed] ${guilds.length} guild(s) prepared, ${staleReactionRoles.count} reaction role(s) and ${staleTickets.length} ticket(s) cleaned up.`,
  );
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
