-- ============================================================
-- Migration: Multi-Step Scheduled Campaigns + Email Tracking
-- Run in Supabase SQL Editor
-- Then re-run scripts/enable-rls.sql
-- ============================================================

-- 1. Evolve CampaignStatus enum — add new values
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'paused';

-- 2. Add new columns to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "isMultiStep"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "startDate"    TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "activatedAt"  TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "completedAt"  TIMESTAMP(3);

-- Make subject and bodyHtml nullable for multi-step campaigns
ALTER TABLE "campaigns" ALTER COLUMN "subject" DROP NOT NULL;
ALTER TABLE "campaigns" ALTER COLUMN "bodyHtml" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "campaigns_startDate_idx" ON "campaigns"("startDate");

-- 3. CampaignEmail table (child emails in a campaign sequence)
CREATE TABLE IF NOT EXISTS "campaign_emails" (
  "id"          TEXT PRIMARY KEY,
  "campaignId"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "step"        INTEGER NOT NULL,
  "dayOffset"   INTEGER NOT NULL,
  "subject"     TEXT NOT NULL,
  "previewText" TEXT,
  "bodyHtml"    TEXT NOT NULL,
  "ctaText"     TEXT,
  "ctaUrl"      TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_emails_campaignId_step_key"
  ON "campaign_emails"("campaignId", "step");
CREATE INDEX IF NOT EXISTS "campaign_emails_campaignId_idx"
  ON "campaign_emails"("campaignId");

-- 4. CampaignProgress table (per-contact tracking through campaign)
CREATE TABLE IF NOT EXISTS "campaign_progress" (
  "id"          TEXT PRIMARY KEY,
  "campaignId"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "contactId"   TEXT NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt"  TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "isPaused"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_progress_campaignId_contactId_key"
  ON "campaign_progress"("campaignId", "contactId");
CREATE INDEX IF NOT EXISTS "campaign_progress_campaignId_completedAt_idx"
  ON "campaign_progress"("campaignId", "completedAt");
CREATE INDEX IF NOT EXISTS "campaign_progress_contactId_idx"
  ON "campaign_progress"("contactId");

-- 5. Email tracking fields on EmailLog
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "trackingId"  TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openedAt"    TIMESTAMP(3);
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "opensCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clickedAt"   TIMESTAMP(3);
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clicksCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_trackingId_key"
  ON "email_logs"("trackingId") WHERE "trackingId" IS NOT NULL;

-- 6. Contact engagement pause fields
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "emailPaused"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "emailPausedAt"    TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "emailPauseReason" TEXT;

CREATE INDEX IF NOT EXISTS "contacts_emailPaused_idx" ON "contacts"("emailPaused");
