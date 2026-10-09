-- =============================================================================
-- 10_core: Core — admin users, site settings, CMS pages and sections, SEO, testimonials, legal documents
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── pages ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pages_slug_key" ON "pages"("slug");

-- ── page_sections ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "page_sections" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "content" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "page_sections_pageId_idx" ON "page_sections"("pageId");

-- ── testimonials ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "testimonials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "location" TEXT,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "imageUrl" TEXT,
    "serviceType" TEXT NOT NULL DEFAULT 'session',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- ── admin_users ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "admin_users" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'editor',
    "settingsPageVisits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_supabaseUserId_key" ON "admin_users"("supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key" ON "admin_users"("email");

-- ── site_settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "site_settings" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL DEFAULT 'Life-Therapy',
    "tagline" TEXT,
    "logoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "businessHours" JSONB,
    "locationText" TEXT,
    "branchAddresses" JSONB,
    "facebookUrl" TEXT,
    "linkedinUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "youtubeUrl" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImageUrl" TEXT,
    "googleAnalyticsId" TEXT,
    "smtpFromName" TEXT,
    "smtpFromEmail" TEXT,
    "copyrightText" TEXT,
    "footerTagline" TEXT,
    "bookingMaxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
    "bookingMinNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "bookingBufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionPriceIndividualZar" INTEGER DEFAULT 85000,
    "sessionPriceIndividualUsd" INTEGER DEFAULT 6500,
    "sessionPriceIndividualEur" INTEGER DEFAULT 5900,
    "sessionPriceIndividualGbp" INTEGER DEFAULT 4900,
    "sessionPriceCouplesZar" INTEGER DEFAULT 120000,
    "sessionPriceCouplesUsd" INTEGER DEFAULT 9500,
    "sessionPriceCouplesEur" INTEGER DEFAULT 8500,
    "sessionPriceCouplesGbp" INTEGER DEFAULT 7500,
    "businessRegistrationNumber" TEXT DEFAULT '2019/570691/07',
    "invoicePrefix" TEXT DEFAULT 'LT',
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "vatPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "bankName" TEXT,
    "bankAccountHolder" TEXT,
    "bankAccountNumber" TEXT,
    "bankBranchCode" TEXT,
    "postpaidDueDays" INTEGER NOT NULL DEFAULT 7,
    "postpaidDueDaysType" TEXT NOT NULL DEFAULT 'business',
    "businessAddress" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappPhoneNumberId" TEXT,
    "whatsappBusinessAccountId" TEXT,
    "whatsappSessionReminders" BOOLEAN NOT NULL DEFAULT true,
    "whatsappBillingReminders" BOOLEAN NOT NULL DEFAULT true,
    "whatsappCreditReminders" BOOLEAN NOT NULL DEFAULT true,
    "creditExpiryDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- Production had VARCHAR; TEXT is the same storage, so this never rewrites the table.
ALTER TABLE "site_settings" ALTER COLUMN "postpaidDueDaysType" SET DATA TYPE TEXT;

-- ── page_seo ──────────────────────────────────────────────────────────────

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

CREATE UNIQUE INDEX IF NOT EXISTS "page_seo_route_key" ON "page_seo"("route");

-- ── legal_documents ───────────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "legal_documents_slug_isActive_idx" ON "legal_documents"("slug", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "legal_documents_slug_version_key" ON "legal_documents"("slug", "version");

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_sections_pageId_fkey' AND conrelid = 'public."page_sections"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "page_sections" DROP CONSTRAINT "page_sections_pageId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_sections_pageId_fkey' AND conrelid = 'public."page_sections"'::regclass) THEN
    ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
