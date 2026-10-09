#!/usr/bin/env node
// scripts/db-apply.mjs — apply prisma/sql/ to a database, in order, in ONE transaction.
// ─────────────────────────────────────────────────────────────────────────────
// THE SCHEMA CHANNEL since 2026-10-09 (owner's ruling on canon's db-tests handover §1).
// prisma/sql/NN_<group>.sql is a FIXED set of files named by function. Every statement in them
// is idempotent, so the whole set is re-run every time rather than tracked as a run-once history:
// running it against a database that is already current changes nothing. A schema change is an
// edit to the right group file plus the matching edit to prisma/schema.prisma, in one commit.
// `npm run db:drift` then proves the two agree. Why not `prisma migrate`: it refuses to re-run a
// migration and breaks if one is edited, which is the opposite of what the owner asked for.
//
// SAFETY
//   • Dry by default: every file runs inside one transaction that is ROLLED BACK, so a dry run
//     proves the SQL executes against the real catalogue without leaving anything behind.
//     `--write` commits. One transaction either way, so a failure in file 7 undoes files 1–6.
//   • PRODUCTION is reached through a file here, never through a URL on the command line — the
//     exact shape of the 2026-08-18 scar (CLAUDE.md §6). So bash-gate ASKS on `db:apply` by name,
//     with a settings twin, rather than hoping to see a URL.
//   • The credential is built from DATABASE_URL in .env.local and never printed.
//
// TARGETS
//   --target=prod          production over the SESSION pooler: DATABASE_URL with :6543 → :5432 and
//                          `pgbouncer` dropped. The transaction pooler cannot run multi-statement
//                          DDL under one transaction the way this needs (schema-changes.md).
//   --url-env=NAME         any other database, its URL read from env var NAME (scripts/db-verify.mjs
//                          uses this for the throwaway Docker database).
//
// Usage:
//   npm run db:apply                 # production, dry — runs everything, rolls back
//   npm run db:apply -- --write      # production, committed
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SQL_DIR = join(ROOT, "prisma", "sql");

// The fixed groups. A new file needs the owner's say-so (they asked for names that stay put),
// so an unknown name fails loudly rather than being picked up by a glob.
export const GROUPS = [
  "00_types",
  "10_core",
  "20_clients",
  "30_bookings",
  "40_billing",
  "50_learning",
  "60_commerce",
  "70_messaging",
  "80_ops",
  "90_cleanup",
  "99_security",
];

export function sqlFiles() {
  const onDisk = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, -4));
  const unknown = onDisk.filter((f) => !GROUPS.includes(f));
  const missing = GROUPS.filter((g) => !onDisk.includes(g));
  if (unknown.length || missing.length) {
    throw new Error(
      `prisma/sql/ does not match the fixed group list` +
        (unknown.length ? `; unknown: ${unknown.join(", ")}` : "") +
        (missing.length ? `; missing: ${missing.join(", ")}` : "") +
        ` — see GROUPS in scripts/db-apply.mjs`,
    );
  }
  return GROUPS.map((g) => join(SQL_DIR, `${g}.sql`));
}

/** Production over the session pooler, built from .env.local. Never logged. */
export function prodSessionUrl() {
  dotenv.config({ path: join(ROOT, ".env.local"), quiet: true });
  const raw = process.env.DATABASE_URL;
  if (!raw || raw.includes("localhost")) throw new Error("DATABASE_URL from .env.local is missing or a placeholder");
  const u = new URL(raw);
  u.port = "5432";
  u.searchParams.delete("pgbouncer");
  return u.toString();
}

export function resolveTarget(argv) {
  const target = argv.find((a) => a.startsWith("--target="))?.slice(9);
  const urlEnv = argv.find((a) => a.startsWith("--url-env="))?.slice(10);
  if (target === "prod") return { label: "PRODUCTION", url: prodSessionUrl() };
  if (urlEnv) {
    const url = process.env[urlEnv];
    if (!url) throw new Error(`--url-env=${urlEnv}: that variable is not set`);
    return { label: urlEnv, url };
  }
  throw new Error("name a target: --target=prod, or --url-env=NAME");
}

/** Runs every group file in one transaction; commits only when `write`. Returns per-file timings. */
export async function applyAll(url, { write, log = console.log } = {}) {
  const client = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
  await client.connect();
  const notices = [];
  client.on("notice", (n) => notices.push(n.message));
  const ran = [];
  try {
    await client.query("BEGIN");
    for (const file of sqlFiles()) {
      const name = file.slice(SQL_DIR.length + 1);
      const t0 = Date.now();
      try {
        await client.query(readFileSync(file, "utf8"));
      } catch (e) {
        throw new Error(`${name}: ${e.message}`);
      }
      ran.push({ name, ms: Date.now() - t0 });
      log(`  ✓ ${name} (${Date.now() - t0}ms)`);
    }
    await client.query(write ? "COMMIT" : "ROLLBACK");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
  return { ran, notices };
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes("--write");
  const { label, url } = resolveTarget(argv);
  console.log(`db:apply → ${label} · ${write ? "WRITE (commits)" : "dry (rolls back)"}`);
  const { notices } = await applyAll(url, { write });
  console.log(`${write ? "committed" : "rolled back"} · ${notices.length} notice(s) (an "already exists, skipping" is the idempotence working)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
