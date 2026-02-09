-- ============================================================
-- Migration: In-House Mailing System (Contacts + Campaigns)
-- Run in Supabase SQL Editor
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE "ContactSource" AS ENUM ('newsletter', 'booking', 'student', 'import', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Contacts table
CREATE TABLE IF NOT EXISTS "contacts" (
  "id"               TEXT PRIMARY KEY,
  "email"            TEXT NOT NULL,
  "firstName"        TEXT,
  "lastName"         TEXT,
  "phone"            TEXT,
  "gender"           TEXT,
  "source"           "ContactSource" NOT NULL DEFAULT 'newsletter',
  "tags"             JSONB,
  "consentGiven"     BOOLEAN NOT NULL DEFAULT false,
  "consentDate"      TIMESTAMP(3),
  "consentMethod"    TEXT,
  "emailOptOut"      BOOLEAN NOT NULL DEFAULT false,
  "unsubscribeToken" TEXT NOT NULL,
  "studentId"        TEXT REFERENCES "students"("id") ON DELETE SET NULL,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_email_key" ON "contacts"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_unsubscribeToken_key" ON "contacts"("unsubscribeToken");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_studentId_key" ON "contacts"("studentId");
CREATE INDEX IF NOT EXISTS "contacts_source_idx" ON "contacts"("source");
CREATE INDEX IF NOT EXISTS "contacts_emailOptOut_idx" ON "contacts"("emailOptOut");

-- Campaigns table
CREATE TABLE IF NOT EXISTS "campaigns" (
  "id"              TEXT PRIMARY KEY,
  "name"            TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "bodyHtml"        TEXT NOT NULL,
  "status"          "CampaignStatus" NOT NULL DEFAULT 'draft',
  "filterSource"    TEXT,
  "filterTags"      JSONB,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount"       INTEGER NOT NULL DEFAULT 0,
  "failedCount"     INTEGER NOT NULL DEFAULT 0,
  "sentAt"          TIMESTAMP(3),
  "sentById"        TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status");

-- ============================================================
-- Cleanup: Drop unused Mailchimp columns from site_settings
-- ============================================================
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "mailchimpApiKey";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "mailchimpAudienceId";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "mailchimpServer";
