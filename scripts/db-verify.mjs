#!/usr/bin/env node
// scripts/db-verify.mjs — prove prisma/sql/ in a throwaway Postgres before it goes near production.
// ─────────────────────────────────────────────────────────────────────────────
// Needs Docker. Starts postgres:17 (production is 17.x), then runs two scenarios. Each asserts
// three things:
//   1. applying every group file succeeds,
//   2. applying them AGAIN changes nothing — the schema dump is byte-identical after both runs,
//      which is what "idempotent" has to mean, measured rather than read off the SQL,
//   3. the result matches prisma/schema.prisma (`db:drift` exits 0).
//
// Scenarios
//   fresh       an empty database: the files alone must build the whole schema.
//   prod-shape  production's public schema, STRUCTURE ONLY (pg_dump --schema-only, no rows),
//               restored first. This exercises the paths a fresh build never takes: the index
//               renames, the foreign keys recreated with the schema's rules, the source TEXT →
//               enum conversion, the drops. Read-only against production; the credential reaches
//               pg_dump through the container's environment, never a command line.
//               Skip with --fresh-only (e.g. no .env.local, as in CI).
//
// The roles `anon` and `authenticated` are Supabase's; a plain Postgres lacks them, so they are
// created here for 99_security.sql to name.
//
// Usage:  npm run db:verify             # both scenarios
//         npm run db:verify -- --fresh-only
// Exit:   0 all green · 1 a scenario failed (the container is removed either way)
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import pg from "pg";
import { applyAll, prodSessionUrl } from "./db-apply.mjs";

const NAME = "lt-db-verify";
const PORT = 54329;
const PW = "verify-only";
const urlFor = (db) => `postgresql://postgres:${PW}@localhost:${PORT}/${db}`;
const freshOnly = process.argv.includes("--fresh-only");

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} … failed:\n${(r.stderr || r.stdout || "").trim().slice(0, 2000)}`);
  return r;
};

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    const c = new pg.Client({ connectionString: urlFor("postgres") });
    try {
      await c.connect();
      await c.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("postgres container never became ready");
}

async function exec(db, sql) {
  const c = new pg.Client({ connectionString: urlFor(db) });
  await c.connect();
  try {
    return await c.query(sql);
  } finally {
    await c.end();
  }
}

// pg_dump ≥17.6 brackets every dump with a random `\restrict <key>` pair (CVE-2025-8714); two
// dumps of one schema differ only there, so those lines are dropped before comparing.
const dump = (db) =>
  sh("docker", ["exec", NAME, "pg_dump", "-U", "postgres", "--schema-only", "--no-owner", "--no-privileges", "--schema=public", db])
    .stdout.replace(/^\\(un)?restrict .*$/gm, "");

function drift(db) {
  const r = sh("node", ["scripts/db-drift.mjs", "--url-env=LT_VERIFY_URL"], { env: { ...process.env, LT_VERIFY_URL: urlFor(db) }, allowFail: true });
  return { ok: r.status === 0, out: (r.stdout + r.stderr).trim() };
}

async function scenario(db, prepare) {
  console.log(`\n▶ ${db}`);
  await exec("postgres", `CREATE DATABASE "${db}"`);
  if (prepare) await prepare(db);
  const quiet = () => {};
  await applyAll(urlFor(db), { write: true, log: quiet });
  const first = dump(db);
  console.log("  ✓ applied");
  await applyAll(urlFor(db), { write: true, log: quiet });
  const second = dump(db);
  if (first !== second) {
    const a = first.split("\n"), b = second.split("\n");
    const gone = a.filter((l) => !b.includes(l)).slice(0, 10), added = b.filter((l) => !a.includes(l)).slice(0, 10);
    throw new Error(`${db}: the second run changed the schema — a statement is not idempotent\n  only after run 1:\n    ${gone.join("\n    ")}\n  only after run 2:\n    ${added.join("\n    ")}`);
  }
  console.log("  ✓ second run changed nothing (schema dump identical)");
  const d = drift(db);
  if (!d.ok) throw new Error(`${db}: does not match schema.prisma\n${d.out}`);
  console.log("  ✓ matches prisma/schema.prisma");
  const rls = await exec(db, `SELECT count(*)::int AS n, count(*) FILTER (WHERE c.relrowsecurity)::int AS rls,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public') AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`);
  const { n, rls: on, policies } = rls.rows[0];
  if (on !== n || policies !== 2 * n) throw new Error(`${db}: RLS on ${on}/${n} tables, ${policies} policies (want ${2 * n})`);
  console.log(`  ✓ RLS on ${on}/${n} tables, ${policies} deny-all policies`);
}

async function main() {
  sh("docker", ["rm", "-f", NAME], { allowFail: true });
  sh("docker", ["run", "-d", "--rm", "--name", NAME, "-e", `POSTGRES_PASSWORD=${PW}`, "-p", `${PORT}:5432`, "postgres:17"]);
  try {
    await waitReady();
    await exec("postgres", `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    END $$`);

    await scenario("fresh");

    if (!freshOnly) {
      await scenario("prod_shape", async (db) => {
        const env = { ...process.env, LT_PROD_URL: prodSessionUrl() };
        const schema = sh("docker", ["exec", "-e", "LT_PROD_URL", NAME, "sh", "-c",
          'pg_dump "$LT_PROD_URL" --schema-only --no-owner --no-privileges --schema=public'], { env }).stdout;
        // pg_dump emits `CREATE SCHEMA public` and Supabase-only comments; the target already has public.
        const sql = schema.replace(/^CREATE SCHEMA public;$/m, "").replace(/^COMMENT ON SCHEMA public .*$/m, "");
        const r = sh("docker", ["exec", "-i", NAME, "psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q"], { input: sql });
        if (r.stderr.trim()) console.log(`  (restore notes: ${r.stderr.trim().split("\n").length} line(s))`);
        const t = await exec(db, `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`);
        console.log(`  ✓ restored production's structure: ${t.rows[0].n} tables, no rows`);
      });
    }
    console.log("\ndb:verify ✓");
  } finally {
    sh("docker", ["rm", "-f", NAME], { allowFail: true });
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
