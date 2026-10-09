#!/usr/bin/env node
// scripts/db-drift.mjs — does a live database match prisma/schema.prisma? Read-only.
// ─────────────────────────────────────────────────────────────────────────────
// Asks Prisma itself (`migrate diff --exit-code`) rather than parsing SQL files: the question is
// whether the DATABASE and the SCHEMA agree, and Prisma is what reads both the same way the app
// will. It prints the SQL that would turn the database into the schema; empty means in step.
// It writes nothing anywhere. Replaces check-schema-drift.mjs, which compared the database with
// the migration FILES, so a file that disagreed with the schema still read as clean.
//
// Prisma does not model RLS, CHECK constraints or functions, so those are outside this check —
// 99_security.sql re-asserts the RLS on every run instead.
//
// Usage:
//   npm run db:drift                       # production (session pooler)
//   node scripts/db-drift.mjs --url-env=X  # any database whose URL is in env var X
// Exit: 0 in step · 2 drift found · 1 the check itself failed.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import { resolveTarget } from "./db-apply.mjs";

const argv = process.argv.slice(2);
const { label, url } = resolveTarget(argv.length ? argv : ["--target=prod"]);

const r = spawnSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script", "--exit-code", "--config", "prisma/drift.config.ts"],
  { env: { ...process.env, LT_DRIFT_URL: url }, encoding: "utf8", shell: process.platform === "win32" },
);

const out = (r.stdout ?? "").replace(/^Loaded Prisma config.*\n/m, "").trim();
if (r.status === 0) {
  console.log(`db:drift → ${label}: in step with prisma/schema.prisma ✓`);
  process.exit(0);
}
if (r.status === 2) {
  console.log(`db:drift → ${label}: DRIFT — this SQL would bring the database to schema.prisma:\n`);
  console.log(out);
  process.exit(2);
}
console.error(`✗ db:drift → ${label}: the check failed (exit ${r.status})\n${(r.stderr ?? "").trim()}`);
process.exit(1);
