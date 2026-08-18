---
paths:
  - "prisma/**"
  - "scripts/**"
---

# Rule — schema changes: Management API, never `prisma migrate`

## The short version

**`npx prisma migrate` and `npx prisma db push` do not work on this project.** Do not reach for
them, do not "just try once" — the bash-gate hook denies them outright. Schema changes are applied
as SQL through the **Supabase Management API**, and Prisma is then re-synced *from* the database.

## Why they fail

`DATABASE_URL` is the Supabase **pgbouncer pooler** (`…pooler.supabase.com:6543?pgbouncer=true`).
Prisma's migration engine needs a *direct* connection: it opens a shadow database, takes advisory
locks, and runs DDL outside the pooled transaction model. Through pgbouncer in transaction-pooling
mode none of that holds, so migrate either hangs, fails to acquire its lock, or reports a drifted
shadow DB. The pooler is correct for the app (serverless needs pooling) — it is simply the wrong
channel for DDL.

## The path that works

1. **Write the DDL** as plain SQL.
2. **Apply it via the Management API** (`SUPABASE_ACCESS_TOKEN` lives in `.env.local`):

   ```bash
   curl -sS -X POST \
     "https://api.supabase.com/v1/projects/ocqucplcdotvewddfmmw/database/query" \
     -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query":"ALTER TABLE bookings ADD COLUMN example text;"}'
   ```

   **The Supabase MCP tools do not work on this project** — every call, even a read-only
   `list_tables`, fails with `MCP error -32600: You do not have permission to perform this action`.
   The REST call above is the only channel that works, for reads as well as DDL. It is `ask`-gated:
   this is **production**, and a statement deserves a glance before it runs.

3. **Re-sync Prisma from the database, don't hand-edit the schema into agreement:**

   ```bash
   npx prisma db pull      # schema.prisma now reflects reality
   npx prisma generate     # regenerate the client at lib/generated/prisma
   ```

4. `npm run check`, then commit `prisma/schema.prisma` with the code that uses the new column.

## Non-negotiables that still apply

- **Never change the schema unless explicitly told to.** (`CLAUDE.md`.) If you think a column is
  needed, describe it and wait. This rule describes *how* to apply an approved change — it is not
  permission to invent one.
- **Never delete data.** Soft-delete: status flags, `isActive: false`, `archivedAt`. That extends to
  DDL — prefer adding a nullable column over dropping or repurposing one, and never `DROP TABLE`.
- **Additive first.** Add the column nullable, backfill, *then* tighten the constraint — a single
  statement that adds `NOT NULL` to a populated table takes a write lock and can fail mid-deploy.
- The **table names are snake_case** via `@@map`: `bookings`, `students`, `payment_requests`,
  `calendar_sync_logs`, `site_settings`, `rate_limits`, `availability_overrides`. Prisma model names
  are not table names — check `schema.prisma` before writing raw SQL.

## Gotcha: the generated client

`lib/generated/prisma` is **git-ignored** and rebuilt by `postinstall` and `build`. A stale local
client is the usual cause of `prisma.someModel is undefined` at runtime after a schema change —
`npx prisma generate` and restart the dev server. Production is unaffected: Vercel regenerates on
every build.

## Gotcha: scripts and env loading

ESM hoists imports, so `dotenv.config()` runs *after* `import { prisma }` and the client initialises
with no `DATABASE_URL` (`.env` holds a `johndoe@localhost` placeholder; the real pooler URL is in
`.env.local`). Run one-off scripts as:

```bash
npx tsx --env-file=.env.local scripts/whatever.ts
```
