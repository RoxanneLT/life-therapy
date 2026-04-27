-- =============================================================================
-- Cleanup: merge contacts → students, data fixes, proforma PDF column
-- Merged from: merge_contacts_data_drop_table + fix_client_statuses_and_booking_link
--              + add_proforma_pdf_url
-- =============================================================================

-- ============================================================
-- 1. Merge contacts data into students, then drop contacts table
--
-- Rules:
--   newsletter source → source='newsletter', newsletterOptIn=true,  marketingOptIn=true
--   import source     → source='import',     newsletterOptIn=false, marketingOptIn=false
--   other sources     → keep source as-is,   newsletterOptIn=true,  marketingOptIn=true
--
-- On email conflict (contact already has a matching student):
--   merge fields into existing student without overwriting non-null values
-- ============================================================

-- Insert contacts that have NO matching student (by email)
INSERT INTO "students" (
  "id",
  "email",
  "firstName",
  "lastName",
  "phone",
  "gender",
  "source",
  "tags",
  "consentGiven",
  "consentDate",
  "consentMethod",
  "emailOptOut",
  "emailPaused",
  "emailPausedAt",
  "emailPauseReason",
  "unsubscribeToken",
  "adminNotes",
  "clientStatus",
  "convertedAt",
  "convertedBy",
  "newsletterOptIn",
  "marketingOptIn",
  "createdAt",
  "updatedAt"
)
SELECT
  c."id",
  c."email",
  COALESCE(c."firstName", 'Friend'),
  COALESCE(c."lastName", ''),
  c."phone",
  c."gender",
  c."source"::text,
  c."tags",
  c."consentGiven",
  c."consentDate",
  c."consentMethod",
  c."emailOptOut",
  c."emailPaused",
  c."emailPausedAt",
  c."emailPauseReason",
  c."unsubscribeToken",
  c."notes",
  COALESCE(c."clientStatus", 'potential'),
  c."convertedAt",
  c."convertedBy",
  -- Newsletter contacts get opted in; import contacts get opted out
  CASE WHEN c."source"::text = 'import' THEN false ELSE true END,
  CASE WHEN c."source"::text = 'import' THEN false ELSE true END,
  c."createdAt",
  c."updatedAt"
FROM "contacts" c
WHERE NOT EXISTS (
  SELECT 1 FROM "students" s WHERE s."email" = c."email"
);

-- For contacts that DO have a matching student, merge non-null fields
UPDATE "students" s
SET
  "phone"            = COALESCE(s."phone", c."phone"),
  "gender"           = COALESCE(s."gender", c."gender"),
  "tags"             = COALESCE(s."tags", c."tags"),
  "adminNotes"       = COALESCE(s."adminNotes", c."notes"),
  "consentGiven"     = s."consentGiven" OR c."consentGiven",
  "consentDate"      = COALESCE(s."consentDate", c."consentDate"),
  "consentMethod"    = COALESCE(s."consentMethod", c."consentMethod"),
  "newsletterOptIn"  = CASE
    WHEN c."source"::text = 'import' THEN s."newsletterOptIn"
    ELSE s."newsletterOptIn" OR true
  END,
  "marketingOptIn"   = CASE
    WHEN c."source"::text = 'import' THEN s."marketingOptIn"
    ELSE s."marketingOptIn" OR true
  END,
  "updatedAt"        = NOW()
FROM "contacts" c
WHERE s."email" = c."email"
  AND s."id" != c."id";

-- Drop the contacts table (CASCADE removes FKs from drip_progress, campaign_progress, etc.)
DROP TABLE IF EXISTS "contacts" CASCADE;

-- Drop the ContactSource enum (no longer used)
DROP TYPE IF EXISTS "ContactSource";

-- ============================================================
-- 2. Data fixes: client statuses + orphan booking linking
-- ============================================================

-- Set all existing clients to "active" except test accounts
UPDATE "students"
SET "clientStatus" = 'active'
WHERE "email" NOT IN ('bouwer.stean@gmail.com', 'roxannebouwer@gmail.com')
  AND "clientStatus" = 'potential';

-- Link orphan bookings to their student record by matching email
UPDATE "bookings" b
SET "studentId" = s."id"
FROM "students" s
WHERE b."clientEmail" = s."email"
  AND b."studentId" IS NULL;

-- ============================================================
-- 3. Add proformaPdfUrl to payment_requests
-- ============================================================

ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "proformaPdfUrl" TEXT;
