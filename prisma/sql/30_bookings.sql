-- =============================================================================
-- 30_bookings: Bookings — sessions, availability overrides, the calendar sync log
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── bookings ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceZarCents" INTEGER NOT NULL DEFAULT 0,
    "priceCurrency" TEXT NOT NULL DEFAULT 'ZAR',
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientNotes" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "sessionNotes" TEXT,
    "sessionMode" "SessionMode" NOT NULL DEFAULT 'online',
    "graphEventId" TEXT,
    "teamsMeetingUrl" TEXT,
    "confirmationToken" TEXT,
    "confirmationSentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studentId" TEXT,
    "originalDate" DATE,
    "originalStartTime" TEXT,
    "rescheduledAt" TIMESTAMP(3),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "creditRefunded" BOOLEAN NOT NULL DEFAULT false,
    "isLateCancel" BOOLEAN NOT NULL DEFAULT false,
    "recurringSeriesId" TEXT,
    "recurringPattern" TEXT,
    "invoiceId" TEXT,
    "paymentRequestId" TEXT,
    "creditedOnPaymentRequestId" TEXT,
    "billingNote" TEXT,
    "couplesPartnerName" TEXT,
    "couplesPartnerEmail" TEXT,
    "couplesPartnerPhone" TEXT,
    "policyOverride" BOOLEAN NOT NULL DEFAULT false,
    "whatsappReminder48hSentAt" TIMESTAMPTZ(6),
    "whatsappReminderMorningSentAt" TIMESTAMPTZ(6),
    "reminderSentFor" TEXT,
    "whatsappReminder24hSentFor" TEXT,
    "whatsappReminderMorningSentFor" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_confirmationToken_key" ON "bookings"("confirmationToken");

CREATE INDEX IF NOT EXISTS "bookings_date_idx" ON "bookings"("date");

CREATE INDEX IF NOT EXISTS "bookings_status_idx" ON "bookings"("status");

CREATE INDEX IF NOT EXISTS "bookings_clientEmail_idx" ON "bookings"("clientEmail");

CREATE INDEX IF NOT EXISTS "bookings_studentId_idx" ON "bookings"("studentId");

CREATE INDEX IF NOT EXISTS "bookings_recurringSeriesId_idx" ON "bookings"("recurringSeriesId");

CREATE INDEX IF NOT EXISTS "bookings_invoiceId_idx" ON "bookings"("invoiceId");

CREATE INDEX IF NOT EXISTS "bookings_paymentRequestId_idx" ON "bookings"("paymentRequestId");

-- ── availability_overrides ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "availability_overrides" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "openSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "availability_overrides_date_key" ON "availability_overrides"("date");

-- ── calendar_sync_logs ────────────────────────────────────────────────────

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

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_studentId_fkey' AND conrelid = 'public."bookings"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "bookings" DROP CONSTRAINT "bookings_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_studentId_fkey' AND conrelid = 'public."bookings"'::regclass) THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
