-- ============================================================
-- Migration: Add CronRun (cron execution tracking for digest)
-- ============================================================

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
