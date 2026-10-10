-- =============================================================================
-- 40_billing: Billing — invoice numbering, invoices, payment requests, billing entities and presets, session credits
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── invoice_sequences ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id")
);

-- ── invoices ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "studentId" TEXT,
    "billingEntityId" TEXT,
    "billingName" TEXT NOT NULL,
    "billingEmail" TEXT NOT NULL,
    "billingAddress" TEXT,
    "billingVatNumber" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "billingMonth" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "lineItems" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "paymentMethod" TEXT,
    "paystackReference" TEXT,
    "paymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidAmountCents" INTEGER,
    "eftReference" TEXT,
    "orderId" TEXT,
    "paymentRequestId" TEXT,
    "creditNoteId" TEXT,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "overdueSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- One invoice per Paystack charge (owner's approval, 2026-10-10). Two deliveries of one charge racing past
-- the webhook's reference checks each made a tax invoice; the second now fails and its retry finds the
-- first (walk-oct-payments-2, W3). NULLs are distinct, so invoices with no charge are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_paystackReference_key" ON "invoices"("paystackReference");

CREATE INDEX IF NOT EXISTS "invoices_studentId_idx" ON "invoices"("studentId");

CREATE INDEX IF NOT EXISTS "invoices_billingEntityId_idx" ON "invoices"("billingEntityId");

CREATE INDEX IF NOT EXISTS "invoices_orderId_idx" ON "invoices"("orderId");

CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

CREATE INDEX IF NOT EXISTS "invoices_type_idx" ON "invoices"("type");

CREATE INDEX IF NOT EXISTS "invoices_billingMonth_idx" ON "invoices"("billingMonth");

-- ── payment_requests ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payment_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT,
    "billingEntityId" TEXT,
    "billingMonth" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "vatAmountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "lineItems" JSONB NOT NULL,
    "paystackReference" TEXT,
    "paymentUrl" TEXT,
    "proformaPdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAmountCents" INTEGER,
    "chasePausedUntil" TIMESTAMPTZ(6),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "dueTodaySentAt" TIMESTAMPTZ(6),
    "overdueSentAt" TIMESTAMP(3),
    "whatsappSentAt" TIMESTAMPTZ(6),
    "whatsappReminderSentAt" TIMESTAMPTZ(6),
    "whatsappDueTodaySentAt" TIMESTAMPTZ(6),
    "whatsappOverdueSentAt" TIMESTAMPTZ(6),
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_requests_status_idx" ON "payment_requests"("status");

CREATE INDEX IF NOT EXISTS "payment_requests_dueDate_idx" ON "payment_requests"("dueDate");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_studentId_billingMonth_key" ON "payment_requests"("studentId", "billingMonth");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_billingEntityId_billingMonth_key" ON "payment_requests"("billingEntityId", "billingMonth");

-- ── billing_entities ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "billing_entities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "vatNumber" TEXT,
    "address" TEXT,
    "accountReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_entities_pkey" PRIMARY KEY ("id")
);

-- ── billing_presets ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "billing_presets" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subLine" TEXT,
    "priceCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'session',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_presets_pkey" PRIMARY KEY ("id")
);

-- ── session_credit_balances ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "session_credit_balances" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(6),
    "expiryWarning14" BOOLEAN NOT NULL DEFAULT false,
    "expiryWarning3" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "session_credit_balances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_credit_balances_studentId_key" ON "session_credit_balances"("studentId");

-- ── session_credit_transactions ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "session_credit_transactions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_credit_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_credit_transactions_studentId_idx" ON "session_credit_transactions"("studentId");

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_invoiceId_fkey' AND conrelid = 'public."bookings"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "bookings" DROP CONSTRAINT "bookings_invoiceId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_invoiceId_fkey' AND conrelid = 'public."bookings"'::regclass) THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_paymentRequestId_fkey' AND conrelid = 'public."bookings"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "bookings" DROP CONSTRAINT "bookings_paymentRequestId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_paymentRequestId_fkey' AND conrelid = 'public."bookings"'::regclass) THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_credit_balances_studentId_fkey' AND conrelid = 'public."session_credit_balances"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "session_credit_balances" DROP CONSTRAINT "session_credit_balances_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_credit_balances_studentId_fkey' AND conrelid = 'public."session_credit_balances"'::regclass) THEN
    ALTER TABLE "session_credit_balances" ADD CONSTRAINT "session_credit_balances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_credit_transactions_studentId_fkey' AND conrelid = 'public."session_credit_transactions"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "session_credit_transactions" DROP CONSTRAINT "session_credit_transactions_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_credit_transactions_studentId_fkey' AND conrelid = 'public."session_credit_transactions"'::regclass) THEN
    ALTER TABLE "session_credit_transactions" ADD CONSTRAINT "session_credit_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relationships_billingEntityId_fkey' AND conrelid = 'public."client_relationships"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "client_relationships" DROP CONSTRAINT "client_relationships_billingEntityId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relationships_billingEntityId_fkey' AND conrelid = 'public."client_relationships"'::regclass) THEN
    ALTER TABLE "client_relationships" ADD CONSTRAINT "client_relationships_billingEntityId_fkey" FOREIGN KEY ("billingEntityId") REFERENCES "billing_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_studentId_fkey' AND conrelid = 'public."invoices"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "invoices" DROP CONSTRAINT "invoices_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_studentId_fkey' AND conrelid = 'public."invoices"'::regclass) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_billingEntityId_fkey' AND conrelid = 'public."invoices"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "invoices" DROP CONSTRAINT "invoices_billingEntityId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_billingEntityId_fkey' AND conrelid = 'public."invoices"'::regclass) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billingEntityId_fkey" FOREIGN KEY ("billingEntityId") REFERENCES "billing_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_studentId_fkey' AND conrelid = 'public."payment_requests"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "payment_requests" DROP CONSTRAINT "payment_requests_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_studentId_fkey' AND conrelid = 'public."payment_requests"'::regclass) THEN
    ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_billingEntityId_fkey' AND conrelid = 'public."payment_requests"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "payment_requests" DROP CONSTRAINT "payment_requests_billingEntityId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_billingEntityId_fkey' AND conrelid = 'public."payment_requests"'::regclass) THEN
    ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_billingEntityId_fkey" FOREIGN KEY ("billingEntityId") REFERENCES "billing_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
