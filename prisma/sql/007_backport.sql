-- 007_backport.sql
-- Backports ad-hoc schema changes that were applied directly to the DB
-- without a corresponding migration. All statements are idempotent.

-- ── hybrid_package_courses ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hybrid_package_courses" (
  "id"               text         NOT NULL,
  "hybridPackageId"  text         NOT NULL,
  "courseId"         text         NOT NULL,
  "sortOrder"        integer      NOT NULL DEFAULT 0,
  CONSTRAINT "hybrid_package_courses_pkey" PRIMARY KEY ("id")
);

-- ── bundle/credit-pack columns ────────────────────────────────────────────────
ALTER TABLE "cart_items"  ADD COLUMN IF NOT EXISTS "bundleId"     text;
ALTER TABLE "cart_items"  ADD COLUMN IF NOT EXISTS "creditPackId" text;

ALTER TABLE "coupons"     ADD COLUMN IF NOT EXISTS "bundleIds"    jsonb;

ALTER TABLE "gifts"       ADD COLUMN IF NOT EXISTS "bundleId"     text;
ALTER TABLE "gifts"       ADD COLUMN IF NOT EXISTS "creditPackId" text;

ALTER TABLE "hybrid_packages" ADD COLUMN IF NOT EXISTS "documentUrl" text;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "bundleId"     text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "creditPackId" text;

-- ── session_credit_packs ──────────────────────────────────────────────────────
-- Table was created ad-hoc; backport the full column set.
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "id"          text                        NOT NULL;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "name"        text                        NOT NULL;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "credits"     integer                     NOT NULL;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "priceCents"  integer                     NOT NULL;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "isPublished" boolean                     NOT NULL DEFAULT true;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "sortOrder"   integer                     NOT NULL DEFAULT 0;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "createdAt"   timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "session_credit_packs" ADD COLUMN IF NOT EXISTS "updatedAt"   timestamp without time zone NOT NULL;

-- ── whatsapp_logs indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent      ON public.whatsapp_logs USING btree ("sentAt");
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_student   ON public.whatsapp_logs USING btree ("studentId");
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_template  ON public.whatsapp_logs USING btree ("templateName");
