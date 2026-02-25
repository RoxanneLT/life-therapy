-- ============================================================
-- Migration: Merge Contact into Student + Digital Onboarding Foundation
-- ============================================================

-- 1. Make supabaseUserId optional on students (allows newsletter-only subscribers)
ALTER TABLE "students" ALTER COLUMN "supabaseUserId" DROP NOT NULL;

-- 2. Add new columns to students (extended profile, lifecycle, communication)
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "relationshipStatus" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "referralDetail" TEXT;

-- Onboarding tracking
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);

-- Client lifecycle
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "clientStatus" TEXT NOT NULL DEFAULT 'potential';
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "convertedBy" TEXT;

-- Source & tags
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'booking';
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "tags" JSONB;

-- Communication preferences
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailPausedAt" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailPauseReason" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "newsletterOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "sessionReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "consentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "consentDate" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "consentMethod" TEXT;

-- Admin notes
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;

-- 3. Add new columns to bookings (reschedule/cancel tracking)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "originalDate" DATE;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "originalStartTime" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rescheduledAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rescheduleCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "creditRefunded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "isLateCancel" BOOLEAN NOT NULL DEFAULT false;

-- Booking → Student FK
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "bookings_studentId_idx" ON "bookings"("studentId");

-- 4. Backfill existing bookings with originalDate/originalStartTime
UPDATE "bookings"
SET "originalDate" = "date",
    "originalStartTime" = "startTime"
WHERE "originalDate" IS NULL;

-- 5. Student indexes
CREATE INDEX IF NOT EXISTS "students_clientStatus_idx" ON "students"("clientStatus");
CREATE INDEX IF NOT EXISTS "students_source_idx" ON "students"("source");

-- 5b. Add client lifecycle columns to contacts BEFORE data migration reads them
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "clientStatus" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "convertedBy" TEXT;
CREATE INDEX IF NOT EXISTS "contacts_clientStatus_idx" ON "contacts"("clientStatus");

-- 6. Migrate Contact data into Student (for contacts linked to a student)
UPDATE "students" s
SET
  "phone"          = COALESCE(s."phone", c."phone"),
  "gender"         = COALESCE(s."gender", c."gender"),
  "source"         = c."source"::TEXT,
  "tags"           = COALESCE(c."tags", s."tags"),
  "consentGiven"   = GREATEST(s."consentGiven"::int, c."consentGiven"::int)::boolean,
  "consentDate"    = COALESCE(s."consentDate", c."consentDate"),
  "consentMethod"  = COALESCE(s."consentMethod", c."consentMethod"),
  "emailPaused"    = c."emailPaused",
  "emailPausedAt"  = c."emailPausedAt",
  "emailPauseReason" = c."emailPauseReason",
  "clientStatus"   = COALESCE(c."clientStatus", 'potential'),
  "convertedAt"    = c."convertedAt",
  "convertedBy"    = c."convertedBy",
  "adminNotes"     = c."notes"
FROM "contacts" c
WHERE c."studentId" = s."id";

-- 7. Migrate DripProgress: contactId → studentId
-- First add the studentId column to drip_progress
ALTER TABLE "drip_progress" ADD COLUMN IF NOT EXISTS "studentId" TEXT;

-- Copy studentId from linked contacts
UPDATE "drip_progress" dp
SET "studentId" = c."studentId"
FROM "contacts" c
WHERE dp."contactId" = c."id"
  AND c."studentId" IS NOT NULL;

-- For drip progress records where the contact has no linked student, we need to
-- create Student records for those contacts first (orphaned newsletter contacts)
-- Skip these for now — they'll be handled by the new upsertContact flow going forward.

-- Drop old FK and add new one
ALTER TABLE "drip_progress" DROP CONSTRAINT IF EXISTS "drip_progress_contactId_fkey";

-- Remove drip_progress records that couldn't be migrated (no linked student)
DELETE FROM "drip_progress" WHERE "studentId" IS NULL;

-- Make studentId required and unique
ALTER TABLE "drip_progress" ALTER COLUMN "studentId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "drip_progress_studentId_key" ON "drip_progress"("studentId");
ALTER TABLE "drip_progress" ADD CONSTRAINT "drip_progress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old contactId column and index
DROP INDEX IF EXISTS "drip_progress_contactId_key";
ALTER TABLE "drip_progress" DROP COLUMN IF EXISTS "contactId";

-- 8. Migrate CampaignProgress: contactId → studentId
ALTER TABLE "campaign_progress" ADD COLUMN IF NOT EXISTS "studentId" TEXT;

-- Copy studentId from linked contacts
UPDATE "campaign_progress" cp
SET "studentId" = c."studentId"
FROM "contacts" c
WHERE cp."contactId" = c."id"
  AND c."studentId" IS NOT NULL;

-- Drop old FK
ALTER TABLE "campaign_progress" DROP CONSTRAINT IF EXISTS "campaign_progress_contactId_fkey";

-- Remove records that couldn't be migrated
DELETE FROM "campaign_progress" WHERE "studentId" IS NULL;

-- Make studentId required
ALTER TABLE "campaign_progress" ALTER COLUMN "studentId" SET NOT NULL;
ALTER TABLE "campaign_progress" ADD CONSTRAINT "campaign_progress_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update unique constraint
DROP INDEX IF EXISTS "campaign_progress_campaignId_contactId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_progress_campaignId_studentId_key"
  ON "campaign_progress"("campaignId", "studentId");

-- Drop old contactId column and indexes
DROP INDEX IF EXISTS "campaign_progress_contactId_idx";
ALTER TABLE "campaign_progress" DROP COLUMN IF EXISTS "contactId";

CREATE INDEX IF NOT EXISTS "campaign_progress_studentId_idx" ON "campaign_progress"("studentId");

-- 9. Remove student relation from contacts (Contact is now deprecated)
-- Drop the FK constraint and column
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_studentId_fkey";
-- Keep studentId column on contacts for backward compat during transition
-- (admin pages still read it for linked student display)

-- 10. (Moved to step 5b above)

-- 11. Create ClientIntake table
CREATE TABLE IF NOT EXISTS "client_intakes" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "behaviours" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "feelings" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "otherBehaviours" TEXT,
  "otherFeelings" TEXT,
  "otherSymptoms" TEXT,
  "additionalNotes" TEXT,
  "adminNotes" TEXT,
  "lastEditedBy" TEXT,
  "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_intakes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_intakes_studentId_key" ON "client_intakes"("studentId");
ALTER TABLE "client_intakes" ADD CONSTRAINT "client_intakes_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 12. Create CommitmentAcknowledgement table
CREATE TABLE IF NOT EXISTS "commitment_acknowledgements" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'v1',
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "commitment_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commitment_acknowledgements_studentId_version_key"
  ON "commitment_acknowledgements"("studentId", "version");
ALTER TABLE "commitment_acknowledgements" ADD CONSTRAINT "commitment_acknowledgements_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. Register portal_welcome email template
INSERT INTO "email_templates" ("id", "key", "name", "category", "subject", "bodyHtml", "variables", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'portal_welcome',
  'Portal Welcome (Free Consultation)',
  'onboarding',
  'Your Life Therapy Portal is Ready',
  '<p>Hi {{firstName}},</p>
<p>Your free consultation is confirmed for <strong>{{sessionDate}}</strong> at <strong>{{sessionTime}}</strong>.</p>
<p>In the meantime, your personal portal is ready:</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{loginUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Login to Your Portal</a>
</div>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Email:</strong> {{email}}</p>
  <p style="margin: 4px 0;"><strong>Temporary password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">{{tempPassword}}</code></p>
</div>
<p style="color: #dc2626; font-weight: 600;">You&rsquo;ll be asked to set your own password on first login.</p>
<p>In your portal you can:</p>
<ul style="color: #555; padding-left: 20px;">
  <li>View your scheduled sessions</li>
  <li>Update your personal details</li>
</ul>
<p>Looking forward to meeting you!</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Accredited Coach &amp; Counsellor</p>',
  '["firstName", "email", "tempPassword", "loginUrl", "sessionDate", "sessionTime"]'::jsonb,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
