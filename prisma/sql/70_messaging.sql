-- =============================================================================
-- 70_messaging: Messaging — email templates and logs, campaigns, drip sequences, WhatsApp templates and logs
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── email_templates ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- Production had a gen_random_uuid() default the app never used: Prisma always supplies the id.
ALTER TABLE "email_templates" ALTER COLUMN "id" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_key_key" ON "email_templates"("key");

-- ── email_logs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "email_logs" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "studentId" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackingId" TEXT,
    "openedAt" TIMESTAMP(3),
    "opensCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clicksCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_trackingId_key" ON "email_logs"("trackingId");

CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs"("to");

CREATE INDEX IF NOT EXISTS "email_logs_templateKey_idx" ON "email_logs"("templateKey");

CREATE INDEX IF NOT EXISTS "email_logs_studentId_idx" ON "email_logs"("studentId");

CREATE INDEX IF NOT EXISTS "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- ── campaigns ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "isMultiStep" BOOLEAN NOT NULL DEFAULT false,
    "filterSource" TEXT,
    "filterClientStatus" TEXT,
    "filterTags" JSONB,
    "audienceFilters" JSONB,
    "campaignType" TEXT NOT NULL DEFAULT 'standard',
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "startDate" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status");

CREATE INDEX IF NOT EXISTS "campaigns_startDate_idx" ON "campaigns"("startDate");

-- ── campaign_emails ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "campaign_emails" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "genderTarget" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_emails_campaignId_idx" ON "campaign_emails"("campaignId");

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_emails_campaignId_step_key" ON "campaign_emails"("campaignId", "step");

-- ── campaign_progress ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "campaign_progress" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_progress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_progress_campaignId_completedAt_idx" ON "campaign_progress"("campaignId", "completedAt");

CREATE INDEX IF NOT EXISTS "campaign_progress_studentId_idx" ON "campaign_progress"("studentId");

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_progress_campaignId_studentId_key" ON "campaign_progress"("campaignId", "studentId");

-- ── drip_emails ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "drip_emails" (
    "id" TEXT NOT NULL,
    "type" "DripEmailType" NOT NULL,
    "step" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "bodyHtml" TEXT NOT NULL,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drip_emails_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "drip_emails_type_idx" ON "drip_emails"("type");

CREATE UNIQUE INDEX IF NOT EXISTS "drip_emails_type_step_key" ON "drip_emails"("type", "step");

-- ── drip_progress ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "drip_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "currentPhase" "DripEmailType" NOT NULL DEFAULT 'onboarding',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drip_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "drip_progress_studentId_key" ON "drip_progress"("studentId");

DO $$ BEGIN
  IF to_regclass('public."drip_progress_phase_step_idx"') IS NOT NULL AND to_regclass('public."drip_progress_currentPhase_currentStep_idx"') IS NULL THEN
    ALTER INDEX "drip_progress_phase_step_idx" RENAME TO "drip_progress_currentPhase_currentStep_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "drip_progress_currentPhase_currentStep_idx" ON "drip_progress"("currentPhase", "currentStep");

CREATE INDEX IF NOT EXISTS "drip_progress_isPaused_idx" ON "drip_progress"("isPaused");

-- ── whatsapp_logs ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "whatsapp_logs" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "studentId" TEXT,
    "waMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_logs_pkey" PRIMARY KEY ("id")
);

-- Production had a gen_random_uuid() default the app never used: Prisma always supplies the id.
ALTER TABLE "whatsapp_logs" ALTER COLUMN "id" DROP DEFAULT;

DO $$ BEGIN
  IF to_regclass('public."idx_whatsapp_logs_student"') IS NOT NULL AND to_regclass('public."whatsapp_logs_studentId_idx"') IS NULL THEN
    ALTER INDEX "idx_whatsapp_logs_student" RENAME TO "whatsapp_logs_studentId_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "whatsapp_logs_studentId_idx" ON "whatsapp_logs"("studentId");

DO $$ BEGIN
  IF to_regclass('public."idx_whatsapp_logs_template"') IS NOT NULL AND to_regclass('public."whatsapp_logs_templateName_idx"') IS NULL THEN
    ALTER INDEX "idx_whatsapp_logs_template" RENAME TO "whatsapp_logs_templateName_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "whatsapp_logs_templateName_idx" ON "whatsapp_logs"("templateName");

DO $$ BEGIN
  IF to_regclass('public."idx_whatsapp_logs_sent"') IS NOT NULL AND to_regclass('public."whatsapp_logs_sentAt_idx"') IS NULL THEN
    ALTER INDEX "idx_whatsapp_logs_sent" RENAME TO "whatsapp_logs_sentAt_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "whatsapp_logs_sentAt_idx" ON "whatsapp_logs"("sentAt");

-- ── whatsapp_templates ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- Production had a gen_random_uuid() default the app never used: Prisma always supplies the id.
ALTER TABLE "whatsapp_templates" ALTER COLUMN "id" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_templates_name_key" ON "whatsapp_templates"("name");

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

-- Production's hand-made name for this key; replaced by Prisma's name below.
ALTER TABLE "whatsapp_logs" DROP CONSTRAINT IF EXISTS "fk_wa_log_student";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_studentId_fkey' AND conrelid = 'public."email_logs"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "email_logs" DROP CONSTRAINT "email_logs_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_logs_studentId_fkey' AND conrelid = 'public."email_logs"'::regclass) THEN
    ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_campaignId_fkey' AND conrelid = 'public."campaign_emails"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "campaign_emails" DROP CONSTRAINT "campaign_emails_campaignId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_emails_campaignId_fkey' AND conrelid = 'public."campaign_emails"'::regclass) THEN
    ALTER TABLE "campaign_emails" ADD CONSTRAINT "campaign_emails_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_progress_campaignId_fkey' AND conrelid = 'public."campaign_progress"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "campaign_progress" DROP CONSTRAINT "campaign_progress_campaignId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_progress_campaignId_fkey' AND conrelid = 'public."campaign_progress"'::regclass) THEN
    ALTER TABLE "campaign_progress" ADD CONSTRAINT "campaign_progress_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_progress_studentId_fkey' AND conrelid = 'public."campaign_progress"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "campaign_progress" DROP CONSTRAINT "campaign_progress_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_progress_studentId_fkey' AND conrelid = 'public."campaign_progress"'::regclass) THEN
    ALTER TABLE "campaign_progress" ADD CONSTRAINT "campaign_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drip_progress_studentId_fkey' AND conrelid = 'public."drip_progress"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "drip_progress" DROP CONSTRAINT "drip_progress_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drip_progress_studentId_fkey' AND conrelid = 'public."drip_progress"'::regclass) THEN
    ALTER TABLE "drip_progress" ADD CONSTRAINT "drip_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_logs_studentId_fkey' AND conrelid = 'public."whatsapp_logs"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "whatsapp_logs" DROP CONSTRAINT "whatsapp_logs_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_logs_studentId_fkey' AND conrelid = 'public."whatsapp_logs"'::regclass) THEN
    ALTER TABLE "whatsapp_logs" ADD CONSTRAINT "whatsapp_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
