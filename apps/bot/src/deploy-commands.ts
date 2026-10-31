import { logger } from "./lib/logger";
import { registerCommands } from "./lib/registerCommands";

async function main(): Promise<void> {
  await registerCommands();
}

main().catch((error) => {
  logger.error("deploy", `Failed to register the commands: ${(error as Error).message}`);
  process.exit(1);
});
