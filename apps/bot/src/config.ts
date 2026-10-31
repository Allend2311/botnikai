import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { z } from "zod";

/**
 * Finds the .env file. When running through `npm run dev -w @guardbot/bot`
 * the cwd is the bot package, so the repository root is checked as well.
 */
function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../../../.env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenvExpand.expand(dotenv.config({ path: candidate }));
      return;
    }
  }
}

loadEnv();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET is required"),
  DISCORD_APPLICATION_ID: z.string().min(1, "DISCORD_APPLICATION_ID is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Supabase connection string)"),
  DIRECT_URL: z.string().optional(),
  APP_URL: z.string().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
  console.error(`\n[config] Invalid environment:\n${issues}\n\nCopy .env.example to .env and fill it in.\n`);
  process.exit(1);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === "production";
