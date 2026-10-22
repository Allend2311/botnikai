/**
 * Writes the Supabase database password into `.env` and verifies the connection.
 *
 *   npm run db:password              # interactive, input is hidden
 *   npm run db:password -- "secret"  # non-interactive
 *
 * The password is URL-encoded automatically, so characters like @ : / ? # &
 * and spaces do not have to be escaped by hand.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");

const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\u007f";

/** Reads a line from stdin without echoing it. */
function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    return Promise.resolve(readFileSync(0, "utf8").trim());
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolvePromise) => {
    let value = "";

    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === CTRL_D) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolvePromise(value);
        return;
      }

      if (char === CTRL_C) {
        process.exit(130);
      }

      if (char === BACKSPACE || char === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      value += char;
      stdout.write("*");
    };

    stdin.on("data", onData);
  });
}

function writePassword(password: string): string {
  const encoded = encodeURIComponent(password);
  const content = readFileSync(ENV_PATH, "utf8");
  const line = `SUPABASE_DB_PASSWORD=${encoded}`;

  const next = /^SUPABASE_DB_PASSWORD=.*$/m.test(content)
    ? content.replace(/^SUPABASE_DB_PASSWORD=.*$/m, line)
    : `${content.replace(/\s*$/, "")}\n\n${line}\n`;

  writeFileSync(ENV_PATH, next, "utf8");
  return encoded;
}

async function main(): Promise<void> {
  const fromArgs = process.argv[2];

  let encoded: string;

  if (fromArgs) {
    encoded = writePassword(fromArgs);
    console.log("✔ SUPABASE_DB_PASSWORD written to .env");
  } else {
    const password = await askHidden("Supabase database password: ");
    if (!password) {
      console.error("No password entered.");
      process.exitCode = 1;
      return;
    }
    encoded = writePassword(password);
    console.log("✔ SUPABASE_DB_PASSWORD written to .env");
  }

  // Build the connection string from the freshly written value.
  const content = readFileSync(ENV_PATH, "utf8");
  const template = /^DATABASE_URL="?([^"\r\n]+)"?/m.exec(content)?.[1];

  if (!template) {
    console.error("Could not read DATABASE_URL from .env");
    process.exitCode = 1;
    return;
  }

  const url = template.replace(/\$\{SUPABASE_DB_PASSWORD\}/g, encoded);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const [{ now }] = await prisma.$queryRawUnsafe<Array<{ now: Date }>>(
      "SELECT now() as now",
    );
    console.log(`✅ Connected — server time ${new Date(now).toISOString()}`);
    console.log("\nNext: npm run db:deploy   (creates the tables)");
  } catch (error) {
    const message = String((error as Error).message).replace(/\s+/g, " ").trim();
    console.error(`❌ ${message}`);

    if (/credentials.*not valid|password authentication failed/i.test(message)) {
      console.error(
        "\nThe password was rejected. Reset it in the dashboard:\n" +
          "  Project Settings > Database > Reset database password",
      );
    }

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
