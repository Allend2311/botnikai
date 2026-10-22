/**
 * Verifies the database connection and lists the tables that exist.
 *
 *   npm run db:check
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://localhost");
  console.log(`Host    : ${url.hostname}:${url.port || 5432}`);
  console.log(`Database: ${url.pathname.replace(/^\//, "") || "postgres"}`);

  try {
    const [{ now }] = await prisma.$queryRawUnsafe<Array<{ now: Date }>>(
      "SELECT now() as now",
    );
    console.log(`\n✅ Connected — server time ${new Date(now).toISOString()}`);
  } catch (error) {
    const message = String((error as Error).message).replace(/\s+/g, " ").trim();
    console.error(`\n❌ Connection failed\n${message}`);

    if (/password authentication failed|credentials.*not valid/i.test(message)) {
      console.error(
        "\nThe database rejected the credentials. Check the username and password in DATABASE_URL.",
      );
    } else if (/ENOTFOUND|Can't reach database server/i.test(message)) {
      console.error("\nThe host could not be reached - check DATABASE_URL and your network.");
    }

    process.exitCode = 1;
    return;
  }

  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );

  const names = tables.map((row) => row.table_name);
  console.log(`\nTables (${names.length}): ${names.join(", ") || "none"}`);

  if (!names.includes("GuildSettings")) {
    console.log("\nThe schema is not applied yet - run: npm run db:deploy");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
