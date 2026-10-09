// Config for `npm run db:drift` only — never for the app or for `prisma generate`.
// Prisma 7 removed `migrate diff --from-url`; a live database is now named through a config
// file's datasource. scripts/db-drift.mjs sets LT_DRIFT_URL in the child's environment (built
// from .env.local, never printed), so no credential is written here or on a command line.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "schema.prisma", // resolved relative to THIS file, unlike prisma.config.ts at the root
  datasource: {
    url: process.env["LT_DRIFT_URL"],
  },
});
