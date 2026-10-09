-- =============================================================================
-- 80_ops: Ops — cron runs, the audit log, rate limits
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── cron_runs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cron_runs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "errorMessage" TEXT,
    "rowsProcessed" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cron_runs_jobName_idx" ON "cron_runs"("jobName");

CREATE INDEX IF NOT EXISTS "cron_runs_status_idx" ON "cron_runs"("status");

CREATE INDEX IF NOT EXISTS "cron_runs_startedAt_idx" ON "cron_runs"("startedAt");

-- ── audit_logs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");

CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Append-only in the database, not only in lib/audit.ts's header (owner's ruling, 2026-10-09).
-- The app connects as the table's owner, so before this anything holding its credentials could
-- rewrite or remove the record of what was done to a client's data. UPDATE, DELETE and TRUNCATE
-- are refused for every role. Lifting it is deliberate and visible: ALTER TABLE … DISABLE TRIGGER,
-- by a person, for a reason (a retention purge, say), and enabled again after.
CREATE OR REPLACE FUNCTION "audit_logs_append_only"() RETURNS trigger
  LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % refused', TG_OP USING ERRCODE = 'insufficient_privilege';
END
$fn$;

CREATE OR REPLACE TRIGGER "audit_logs_no_change" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();

CREATE OR REPLACE TRIGGER "audit_logs_no_truncate" BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_append_only"();

-- ── rate_limits ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowEnd" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

DO $$ BEGIN
  IF to_regclass('public."rate_limits_windowend_idx"') IS NOT NULL AND to_regclass('public."rate_limits_windowEnd_idx"') IS NULL THEN
    ALTER INDEX "rate_limits_windowend_idx" RENAME TO "rate_limits_windowEnd_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "rate_limits_windowEnd_idx" ON "rate_limits"("windowEnd");
