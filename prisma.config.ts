import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (has real credentials), then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  // No migrations path: the schema channel is prisma/sql/ (scripts/db-apply.mjs), not Prisma's
  // run-once history, which was archived to prisma/sql/archive/prisma-migrations on 2026-10-09.
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
