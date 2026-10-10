#!/usr/bin/env node
// scripts/db-test.mjs — the database test tier: every *.dbtest.ts, against a throwaway Postgres.
// ─────────────────────────────────────────────────────────────────────────────
// Builds a fresh database from prisma/sql/ (the same files production runs), then runs the tier with
// DATABASE_URL pointed at it. The database is dropped and rebuilt on every run, so a test owns its
// rows by giving them unique emails (test/db/harness.ts), and nothing needs cleaning up afterwards.
//
// Kept out of `npm run check` so the local gate does not need Docker; CI runs it as its own job.
//
// Where the server comes from:
//   LT_TEST_DATABASE_URL set  → that server (CI's postgres service). Its database is replaced.
//   otherwise                 → a postgres:17 container started here and removed afterwards.
// Either way the host must be localhost. This tier creates and drops databases, so a hosted URL is
// refused outright rather than trusted: CI must hold no production credential, and a laptop's
// shell may well have one exported.
//
// The child gets a fixed test ENCRYPTION_KEY (the Prisma extension encrypts student phone/notes
// fields) and TZ=UTC, the runner's zone in CI, so a laptop in SAST cannot pass what CI fails.
//
// Usage:  npm run test:db
// Exit:   the test runner's exit code · 1 if the database could not be built
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { applyAll } from "./db-apply.mjs";
import { startPostgres, stopPostgres, waitReady, exec, ensureSupabaseRoles } from "./db-docker.mjs";

const NAME = "lt-db-test";
const PORT = 54330;
const DB = "lt_dbtest";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
// Not a secret: 64 hex chars that only ever encrypt fixture rows in a database dropped next run.
const TEST_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

function discover(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "generated" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) discover(p, out);
    else if (e.name.endsWith(".dbtest.ts")) out.push(relative(process.cwd(), p).replaceAll("\\", "/"));
  }
  return out;
}

function withDatabase(serverUrl, db) {
  const u = new URL(serverUrl);
  u.pathname = `/${db}`;
  return u.toString();
}

async function main() {
  const files = ["lib", "test"].flatMap((d) => discover(d)).sort();
  if (files.length === 0) throw new Error("no *.dbtest.ts files found under lib/ or test/");

  const given = process.env.LT_TEST_DATABASE_URL;
  const server = given ?? startPostgres(NAME, PORT, "dbtest-only")("postgres");
  try {
    const host = new URL(server).hostname;
    if (!LOCAL_HOSTS.has(host)) throw new Error(`refusing a non-local server (${host}): test:db drops and recreates databases`);

    await waitReady(server);
    await ensureSupabaseRoles(server);
    await exec(server, `DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await exec(server, `CREATE DATABASE "${DB}"`);
    const url = withDatabase(server, DB);
    await applyAll(url, { write: true, log: () => {} });
    // Invoice numbers come from one row, which production has and prisma/sql/ does not create. Seeded
    // here, once: each file upserting it in a `before` raced when the files ran in parallel, and the
    // loser's unique violation failed that file's every test (walk-oct-payments-3 02, F5).
    await exec(url, `INSERT INTO "invoice_sequences" ("id") VALUES ('global') ON CONFLICT DO NOTHING`);
    console.log(`test:db → ${host} · ${DB} built from prisma/sql/ · ${files.length} file(s)\n`);

    // Module mocks let a test drive a server action with requireRole and next/cache stood in, so
    // what an admin's click writes is tested against a real database (lib/payment-admin.dbtest.ts).
    const r = spawnSync("npx", ["tsx", "--experimental-test-module-mocks", "--test", ...files], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, DATABASE_URL: url, LT_DB_TEST: "1", TZ: "UTC", ENCRYPTION_KEY: TEST_ENCRYPTION_KEY },
    });
    return r.status ?? 1;
  } finally {
    if (!given) stopPostgres(NAME);
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`\n✗ test:db: ${e.message}`);
    process.exit(1);
  },
);
