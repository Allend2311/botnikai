import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [{ emit: "event", level: "warn" }, { emit: "event", level: "error" }],
  });

prisma.$on("warn" as never, (event: { message: string }) => logger.warn("prisma", event.message));
prisma.$on("error" as never, (event: { message: string }) => logger.error("prisma", event.message));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
