-- ============================================================
-- Migration: Add CalendarSyncLog (calendar reconciliation audit trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS "calendar_sync_logs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "seriesId" TEXT,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "graphEventId" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_sync_logs_bookingId_idx" ON "calendar_sync_logs"("bookingId");
CREATE INDEX IF NOT EXISTS "calendar_sync_logs_status_idx" ON "calendar_sync_logs"("status");
CREATE INDEX IF NOT EXISTS "calendar_sync_logs_createdAt_idx" ON "calendar_sync_logs"("createdAt");
