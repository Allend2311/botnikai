import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "node:path";
import { defineConfig } from "prisma/config";

dotenvExpand.expand(dotenv.config());

/**
 * Prisma 7 no longer reads the `prisma` key from package.json, so the
 * configuration lives here. `.env` is loaded explicitly because Prisma stops
 * loading it automatically as soon as this file exists.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
