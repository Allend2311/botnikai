import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import type { NextConfig } from "next";

/**
 * The repository keeps a single `.env` in the root, but Next.js only looks for
 * env files inside `apps/web`. Loading the root file here makes sure both the
 * bot and the website share the same configuration — and that it is available
 * during `next build` as well as `next start`.
 */
function loadEnvFiles(): void {
  const candidates = [
    path.join(__dirname, "../../.env"), // repository root
    path.join(__dirname, "../.env"), // apps/web/.env
    path.join(process.cwd(), ".env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenvExpand.expand(dotenv.config({ path: candidate }));
      return;
    }
  }
}

loadEnvFiles();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // The repository root holds the workspace lockfile, so Next needs to know
  // where to look for files during tracing.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
