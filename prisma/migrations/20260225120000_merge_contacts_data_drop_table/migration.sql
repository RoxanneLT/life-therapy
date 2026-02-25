-- ============================================================
-- Migration: Merge contacts data into students, then drop contacts table
--
-- Rules:
--   newsletter source → source='newsletter', newsletterOptIn=true,  marketingOptIn=true
--   import source     → source='import',     newsletterOptIn=false, marketingOptIn=false
--   other sources     → keep source as-is,   newsletterOptIn=true,  marketingOptIn=true
--
-- On email conflict (contact already has a matching student):
--   merge fields into existing student without overwriting non-null values
-- ============================================================

-- 1. Insert contacts that have NO matching student (by email)
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

-- 2. For contacts that DO have a matching student, merge non-null fields
--    Never overwrite existing non-null values; only fill blanks
UPDATE "students" s
SET
  "phone"            = COALESCE(s."phone", c."phone"),
  "gender"           = COALESCE(s."gender", c."gender"),
  "tags"             = COALESCE(s."tags", c."tags"),
  "adminNotes"       = COALESCE(s."adminNotes", c."notes"),
  -- Upgrade consent: only go from false→true, never downgrade
  "consentGiven"     = s."consentGiven" OR c."consentGiven",
  "consentDate"      = COALESCE(s."consentDate", c."consentDate"),
  "consentMethod"    = COALESCE(s."consentMethod", c."consentMethod"),
  -- Respect newsletter/import source preferences for communication
  "newsletterOptIn"  = CASE
    WHEN c."source"::text = 'import' THEN s."newsletterOptIn" -- don't change existing student prefs
    ELSE s."newsletterOptIn" OR true  -- newsletter contacts: ensure opted in
  END,
  "marketingOptIn"   = CASE
    WHEN c."source"::text = 'import' THEN s."marketingOptIn"
    ELSE s."marketingOptIn" OR true
  END,
  "updatedAt"        = NOW()
FROM "contacts" c
WHERE s."email" = c."email"
  AND s."id" != c."id";  -- only where contact is a separate record

-- 3. Drop the contacts table
DROP TABLE IF EXISTS "contacts" CASCADE;

-- 4. Drop the ContactSource enum (no longer used)
DROP TYPE IF EXISTS "ContactSource";
