# prisma/sql/archive — history, never run

Retired on 2026-10-09, when the schema channel became the grouped, re-runnable files one level up
(`00_types.sql` … `99_security.sql`, applied by `npm run db:apply`).

- `000`–`007` are the old numbered SQL files. Their DDL is now in the grouped files.
  The seed data in `003` (email templates) and `004` (drip and campaign content) stayed here:
  those rows are live in production and edited by the admin, so they don't belong in a set that
  re-runs.
- `prisma-migrations/` was Prisma's run-once migration history. It had stopped matching production:
  `_prisma_migrations` records different migration names, and the schema had moved on since June.
  The `_prisma_migrations` table itself was left alone in production.

Nothing reads this folder. `scripts/db-apply.mjs` takes only the fixed group files at the top level.
