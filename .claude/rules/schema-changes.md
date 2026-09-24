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

3. **Re-sync Prisma from the database — but read the two paragraphs below before running it:**

   ```bash
   npx prisma db pull      # NOT as-is: see "db pull needs the session pooler"
   npx prisma generate     # regenerate the client at lib/generated/prisma
   ```

   **`db pull` needs the session pooler, and hangs silently without it.** `DATABASE_URL` *and*
   `DIRECT_URL` both point at the transaction pooler on **6543** — `DIRECT_URL` is not direct, whatever
   the name says. Introspection needs prepared statements, which transaction pooling does not give it,
   so `npx prisma db pull` produces **no output at all** and never returns. That looks like a slow
   query, not a wrong channel, so it gets waited on. Supabase serves a **session-mode** pooler on
   **5432** at the same host: run `db pull` with `DATABASE_URL` and `DIRECT_URL` rewritten from `:6543/`
   to `:5432/` and `pgbouncer=true` dropped — build it from the env var in a script, never by pasting
   the credential.

   **Take the model, not the file.** `db pull` rewrites `schema.prisma` whole: it drops every `@db.Text`
   annotation, every `//` section banner, and reorders fields. Diff its output against the committed
   schema with comments stripped, confirm the only difference is the change you applied, then copy
   **that model's lines** in by hand. Hand-editing into agreement is what this step exists to prevent;
   pasting a lossy rewrite over a reviewed file is the other failure, and the diff is what tells the
   two apart. Measured 2026-09-24 adding `availability_overrides."openSlots"`.

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
