---
paths:
  - "prisma/**"
  - "scripts/**"
---

# Rule — schema changes: the grouped files in `prisma/sql/`, applied with `npm run db:apply`

## The short version

Since 2026-10-09 (owner's ruling on canon's db-tests handover §1), a schema change is:

1. an edit to the right **group file** in `prisma/sql/`, written to be **re-runnable**, plus
2. the matching edit to `prisma/schema.prisma`, **in the same commit**, then
3. `npm run db:verify` (Docker), then `npm run db:apply` (production, dry), then
   `npm run db:apply -- --write`, then `npm run db:drift`, which must say *in step*.

`prisma migrate` (except the read-only `migrate diff`) and `prisma db push` are denied by `bash-gate`.
They are not this project's channel: Prisma's history runs each migration once and breaks if one is
edited, and the owner asked for the opposite.

## The groups — fixed, by function

```
00_types      the schema and every enum            60_commerce   orders, carts, coupons, gifts, packages,
10_core       admin, settings, CMS, SEO, legal                   digital products, access grants
20_clients    students, intakes, relationships     70_messaging  email, campaigns, drip, WhatsApp
30_bookings   bookings, availability, calendar log 80_ops        cron runs, audit log, rate limits
40_billing    invoices, payment requests, credits  90_cleanup    removals, each with its ruling
50_learning   courses … certificates               99_security   RLS on every table — always last
```

**The names stay put.** A new file is the owner's decision. `GROUPS` in `scripts/db-apply.mjs` is the
list, and the audit (`schema: prisma/sql holds exactly the fixed groups`) fails on any other file.
A table lives in its domain's file. A foreign key lives in the **later** of its two tables' groups,
so both tables exist when it runs.

## Re-runnable, which is the whole point

Every statement brings the database **to** a state, so re-running the full set changes nothing:

| Want | Write |
|---|---|
| a table, index, enum value | `CREATE TABLE IF NOT EXISTS` · `CREATE INDEX IF NOT EXISTS` · `ALTER TYPE … ADD VALUE IF NOT EXISTS` |
| a column | `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — nullable, or with a default (see below) |
| a type/default change | `ALTER TABLE … ALTER COLUMN …` (already idempotent) — or a `DO` block guarding a cast |
| a constraint, an enum, a rename | a `DO $$ … $$` block that checks `pg_constraint` / `pg_type` / `to_regclass` first — copy the shape already in the files |
| a removal | in `90_cleanup.sql`, `… IF EXISTS`, with the owner's ruling and date beside it |
| rows | **not here** — `prisma/sql/seeds/`, run by hand |

The audit (`schema: every prisma/sql group statement is re-runnable`) holds that shape at commit time.
`npm run db:verify` measures it: two runs in Docker, with identical schema dumps after each.

## The commands

| Command | Does | Gated |
|---|---|---|
| `npm run db:verify` | throwaway Postgres 17 in Docker. Builds from empty, and from a no-rows copy of production's structure. Each is applied twice and must match `schema.prisma` | no (local only) |
| `npm run db:apply` | production, **dry**: every file in one transaction, then ROLLBACK | **asks** (`bash-gate`, by name) |
| `npm run db:apply -- --write` | production, committed. One transaction, so a failure anywhere undoes everything | **asks** |
| `npm run db:drift` | read-only: Prisma's own `migrate diff` between production and `schema.prisma`. Empty = in step | no |

Production is reached over the **session pooler**: `DATABASE_URL` with `:6543` → `:5432` and
`pgbouncer` dropped, built inside the script from `.env.local` and never printed. The app keeps the
transaction pooler. That is the one that hangs `prisma db pull` and can't run multi-statement DDL in a
transaction.

`db:drift` does not see RLS, CHECK constraints or functions. Prisma does not model them, which is
why `99_security.sql` re-asserts RLS on every run.

## Non-negotiables that still apply

- **Never change the schema unless explicitly told to.** (`CLAUDE.md`.) If you think a column is
  needed, describe it and wait. This rule describes *how* to apply an approved change. It doesn't
  give permission to invent one.
- **A removal needs the owner's explicit ruling**, recorded beside it in `90_cleanup.sql`, and any rows
  are exported first. Rows of irreplaceable records are never removed at all. Soft-delete them
  (`CLAUDE.md` §4).
- **Additive first.** Add the column nullable, backfill, *then* tighten. A `NOT NULL` added to a
  populated table in one statement takes a write lock and fails if any row is null.
- **Change in place, never drop-and-re-add.** Prisma's own diff turns a type change into
  `DROP COLUMN` + `ADD COLUMN`, which erases the values. Measured on 2026-10-09 on
  `module_access.source`. Write `ALTER COLUMN … TYPE … USING …` instead.
- **Table names are snake_case** via `@@map` (`bookings`, `payment_requests`, `rate_limits` …).
  Prisma model names are not table names.
- **Reading production:** the Supabase MCP server (`execute_sql` with a `SELECT`, which asks), or
  `db:drift`. The Management API over REST still works, and `bash-gate` asks on it, but it's no longer
  the DDL path.

## Gotcha: the generated client

`lib/generated/prisma` is **git-ignored** and rebuilt by `postinstall` and `build`. A stale local
client is the usual cause of `prisma.someModel is undefined` at runtime after a schema change. Fix it
with `npx prisma generate`, then restart the dev server. Production is unaffected: Vercel regenerates
on every build.

## Gotcha: `prisma format` reflows the whole file

`schema.prisma` is hand-aligned. `npx prisma format` realigns every model, so a five-line change
becomes a thousand-line diff that hides it (measured 2026-10-09: 42 edits became 1,025 changed
lines). Use `npx prisma validate` to check it instead.

## Gotcha: scripts and env loading

ESM hoists imports, so `dotenv.config()` runs *after* `import { prisma }` and the client initialises
with no `DATABASE_URL`. `.env` holds a `johndoe@localhost` placeholder; the real pooler URL is in
`.env.local`. Run one-off scripts as:

```bash
npx tsx --env-file=.env.local scripts/whatever.ts
```
