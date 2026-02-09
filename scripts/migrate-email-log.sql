-- ============================================================
-- Migration: EmailLog table for email delivery tracking
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id"           TEXT PRIMARY KEY,
  "templateKey"  TEXT,
  "to"           TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "status"       TEXT NOT NULL,
  "error"        TEXT,
  "studentId"    TEXT REFERENCES "students"("id") ON DELETE SET NULL,
  "metadata"     JSONB,
  "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs"("to");
CREATE INDEX IF NOT EXISTS "email_logs_templateKey_idx" ON "email_logs"("templateKey");
CREATE INDEX IF NOT EXISTS "email_logs_studentId_idx" ON "email_logs"("studentId");
CREATE INDEX IF NOT EXISTS "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- ============================================================
-- Migration: Student email preferences columns
-- ============================================================
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

-- Generate tokens for existing students
UPDATE "students"
SET "unsubscribeToken" = gen_random_uuid()::text
WHERE "unsubscribeToken" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "students_unsubscribeToken_key" ON "students"("unsubscribeToken");

-- ============================================================
-- Seed: password_changed email template
-- ============================================================
INSERT INTO "email_templates" ("id", "key", "name", "category", "subject", "bodyHtml", "variables", "isActive", "createdAt", "updatedAt")
VALUES (
  'tmpl_password_changed',
  'password_changed',
  'Password Changed',
  'onboarding',
  'Your Life-Therapy password has been changed',
  '<p>Hi {{firstName}},</p>
<p>Your password has been successfully changed.</p>
<p>If you did not make this change, please contact us immediately at <a href="mailto:hello@life-therapy.co.za" style="color: #8BA889;">hello@life-therapy.co.za</a>.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName"]',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
