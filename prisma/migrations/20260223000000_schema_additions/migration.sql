-- =============================================================================
-- Schema Additions: SEO, legal documents, drop secret columns
-- Merged from: add_page_seo + drop_secret_columns + legal_documents
-- =============================================================================

-- ============================================================
-- Page SEO
-- ============================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "page_seo" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImageUrl" TEXT,
    "keywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_seo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "page_seo_route_key" ON "page_seo"("route");

-- Add SEO fields to courses
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- Add SEO fields to hybrid_packages
ALTER TABLE "hybrid_packages" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "hybrid_packages" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- Add SEO fields to digital_products
ALTER TABLE "digital_products" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "digital_products" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;

-- Seed default PageSeo rows for all static routes
INSERT INTO "page_seo" ("id", "route", "metaTitle", "metaDescription", "ogImageUrl", "updatedAt") VALUES
  (gen_random_uuid()::text, '/', 'Life-Therapy | Personal Development & Life Coaching', 'Transform your life with Roxanne Bouwer. Qualified life coach, counsellor & NLP practitioner offering online courses and 1:1 sessions.', '/images/hero-home.jpg', NOW()),
  (gen_random_uuid()::text, '/about', 'About Roxanne Bouwer', 'Meet Roxanne Bouwer — qualified life coach, counsellor, and NLP practitioner helping you build confidence and create meaningful change.', '/images/roxanne-portrait.jpg', NOW()),
  (gen_random_uuid()::text, '/sessions', '1:1 Online Sessions', 'Personalised online life coaching and counselling sessions with Roxanne Bouwer. Secure video calls from anywhere in the world.', '/images/hero-sessions.jpg', NOW()),
  (gen_random_uuid()::text, '/courses', 'Online Courses', 'Self-paced online courses covering self-esteem, confidence, anxiety, relationships, and more. Expert-designed by Roxanne Bouwer.', '/images/hero-courses.jpg', NOW()),
  (gen_random_uuid()::text, '/packages', 'Bundles & Packages', 'Get more value with curated course bundles. Combine self-paced learning for the ultimate personal growth experience.', '/images/hero-packages.jpg', NOW()),
  (gen_random_uuid()::text, '/products', 'Digital Products', 'Downloadable workbooks, toolkits, and guides to support your personal growth journey.', '/images/hero-home.jpg', NOW()),
  (gen_random_uuid()::text, '/book', 'Book a Session', 'Book a free consultation or schedule a 1:1 coaching session with Roxanne Bouwer.', '/images/hero-book.jpg', NOW()),
  (gen_random_uuid()::text, '/contact', 'Contact', 'Get in touch with Life-Therapy. Reach out via email, WhatsApp, or book a free consultation.', '/images/hero-contact.jpg', NOW())
ON CONFLICT ("route") DO NOTHING;

-- ============================================================
-- Drop secret columns from site_settings (moved to env vars)
-- ============================================================

ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpHost";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpPort";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpUser";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "smtpPass";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphTenantId";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphClientId";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphClientSecret";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "msGraphUserEmail";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stripeSecretKey";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stripePublishableKey";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "stripeWebhookSecret";

-- ============================================================
-- Legal Documents
-- ============================================================

-- CreateTable: legal_documents
CREATE TABLE IF NOT EXISTS "legal_documents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeSummary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_documents_slug_version_key" ON "legal_documents"("slug", "version");
CREATE INDEX IF NOT EXISTS "legal_documents_slug_isActive_idx" ON "legal_documents"("slug", "isActive");

-- CreateTable: document_acceptances
CREATE TABLE IF NOT EXISTS "document_acceptances" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentSlug" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_acceptances_studentId_documentSlug_documentVersion_key"
    ON "document_acceptances"("studentId", "documentSlug", "documentVersion");
CREATE INDEX IF NOT EXISTS "document_acceptances_studentId_documentSlug_idx"
    ON "document_acceptances"("studentId", "documentSlug");

ALTER TABLE "document_acceptances"
    ADD CONSTRAINT "document_acceptances_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_acceptances"
    ADD CONSTRAINT "document_acceptances_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: deny-all for anon + authenticated (service_role bypasses)
ALTER TABLE "legal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_acceptances" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'deny_all_anon') THEN
    CREATE POLICY "deny_all_anon" ON "legal_documents" FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'legal_documents' AND policyname = 'deny_all_authenticated') THEN
    CREATE POLICY "deny_all_authenticated" ON "legal_documents" FOR ALL TO authenticated USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_acceptances' AND policyname = 'deny_all_anon') THEN
    CREATE POLICY "deny_all_anon" ON "document_acceptances" FOR ALL TO anon USING (false) WITH CHECK (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_acceptances' AND policyname = 'deny_all_authenticated') THEN
    CREATE POLICY "deny_all_authenticated" ON "document_acceptances" FOR ALL TO authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
