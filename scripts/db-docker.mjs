// scripts/db-docker.mjs — the throwaway Postgres that db:verify and test:db both stand up.
// ─────────────────────────────────────────────────────────────────────────────
// postgres:17, because production is 17.x. Every URL built here is localhost, and test:db refuses
// any other (scripts/db-test.mjs), so nothing in this module can reach a hosted database.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import pg from "pg";

export const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} … failed:\n${(r.stderr || r.stdout || "").trim().slice(0, 2000)}`);
  return r;
};

/** Start a fresh container; returns `urlFor(db)` for it. Any earlier container of that name is removed. */
export function startPostgres(name, port, password) {
  sh("docker", ["rm", "-f", name], { allowFail: true });
  sh("docker", ["run", "-d", "--rm", "--name", name, "-e", `POSTGRES_PASSWORD=${password}`, "-p", `${port}:5432`, "postgres:17"]);
  return (db) => `postgresql://postgres:${password}@localhost:${port}/${db}`;
}

export const stopPostgres = (name) => sh("docker", ["rm", "-f", name], { allowFail: true });

export async function waitReady(url) {
  for (let i = 0; i < 60; i++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("postgres never became ready");
}

export async function exec(url, sql) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await c.query(sql);
  } finally {
    await c.end();
  }
}

// `anon` and `authenticated` are Supabase's roles; a plain Postgres lacks them, and 99_security.sql
// names both in its policies. Roles are cluster-wide, so once per server is enough.
export const ensureSupabaseRoles = (url) =>
  exec(url, `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$`);
