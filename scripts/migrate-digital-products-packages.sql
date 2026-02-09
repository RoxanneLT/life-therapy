-- =============================================================================
-- Migration: Digital Products + Pick-Your-Own Packages
-- =============================================================================
-- Run in Supabase SQL Editor. Idempotent (safe to run multiple times).
-- Run enable-rls.sql after this to cover new tables.
-- =============================================================================

-- 1. NEW TABLE: digital_products
CREATE TABLE IF NOT EXISTS public.digital_products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  "imageUrl" TEXT,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "fileSizeBytes" INTEGER,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "priceCentsUsd" INTEGER,
  "priceCentsEur" INTEGER,
  "priceCentsGbp" INTEGER,
  category TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on slug if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'digital_products_slug_key'
  ) THEN
    ALTER TABLE public.digital_products ADD CONSTRAINT digital_products_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 2. NEW TABLE: digital_product_access
CREATE TABLE IF NOT EXISTS public.digital_product_access (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT NOT NULL,
  "digitalProductId" TEXT NOT NULL,
  "orderId" TEXT,
  source TEXT NOT NULL DEFAULT 'purchase',
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'digital_product_access_studentId_fkey'
      AND table_name = 'digital_product_access'
  ) THEN
    ALTER TABLE public.digital_product_access
      ADD CONSTRAINT "digital_product_access_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'digital_product_access_digitalProductId_fkey'
      AND table_name = 'digital_product_access'
  ) THEN
    ALTER TABLE public.digital_product_access
      ADD CONSTRAINT "digital_product_access_digitalProductId_fkey"
      FOREIGN KEY ("digitalProductId") REFERENCES public.digital_products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint + indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'dpa_student_product_unique'
  ) THEN
    ALTER TABLE public.digital_product_access
      ADD CONSTRAINT dpa_student_product_unique UNIQUE ("studentId", "digitalProductId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dpa_studentId_idx ON public.digital_product_access ("studentId");
CREATE INDEX IF NOT EXISTS dpa_digitalProductId_idx ON public.digital_product_access ("digitalProductId");

-- 3. ALTER hybrid_packages: add slot columns
ALTER TABLE public.hybrid_packages
  ADD COLUMN IF NOT EXISTS "courseSlots" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.hybrid_packages
  ADD COLUMN IF NOT EXISTS "digitalProductSlots" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing fixed packages: set courseSlots = count of linked courses
DO $$
DECLARE
  pkg RECORD;
  course_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hybrid_package_courses') THEN
    FOR pkg IN SELECT id FROM public.hybrid_packages LOOP
      SELECT COUNT(*) INTO course_count
      FROM public.hybrid_package_courses
      WHERE "hybridPackageId" = pkg.id;
      IF course_count > 0 THEN
        UPDATE public.hybrid_packages SET "courseSlots" = course_count WHERE id = pkg.id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 4. ALTER cart_items: add digitalProductId + packageSelections
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS "digitalProductId" TEXT;
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS "packageSelections" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cart_items_digitalProductId_fkey'
      AND table_name = 'cart_items'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT "cart_items_digitalProductId_fkey"
      FOREIGN KEY ("digitalProductId") REFERENCES public.digital_products(id);
  END IF;
END $$;

-- 5. ALTER order_items: add digitalProductId + packageSelections
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "digitalProductId" TEXT;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "packageSelections" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_digitalProductId_fkey'
      AND table_name = 'order_items'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT "order_items_digitalProductId_fkey"
      FOREIGN KEY ("digitalProductId") REFERENCES public.digital_products(id);
  END IF;
END $$;

-- 6. ALTER gifts: add digitalProductId + packageSelections
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS "digitalProductId" TEXT;
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS "packageSelections" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gifts_digitalProductId_fkey'
      AND table_name = 'gifts'
  ) THEN
    ALTER TABLE public.gifts
      ADD CONSTRAINT "gifts_digitalProductId_fkey"
      FOREIGN KEY ("digitalProductId") REFERENCES public.digital_products(id);
  END IF;
END $$;

-- =============================================================================
-- 7. DROP old join table + documentUrl (uncomment when ready)
-- =============================================================================
-- Run these AFTER confirming the slot migration worked and all code is updated:
--
-- DROP TABLE IF EXISTS public.hybrid_package_courses;
-- ALTER TABLE public.hybrid_packages DROP COLUMN IF EXISTS "documentUrl";

-- =============================================================================
-- 8. SEED DATA: 5 Digital Products + 3 Pick-Your-Own Packages
-- =============================================================================

-- Digital Products (use placeholder file URLs)
INSERT INTO public.digital_products (id, title, slug, description, "fileUrl", "fileName", "priceCents", "priceCentsUsd", "priceCentsEur", "priceCentsGbp", category, "isPublished", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('dp_self_esteem_workbook', 'Self-Esteem Workbook', 'self-esteem-workbook',
   'A comprehensive printable workbook with guided exercises to build lasting self-esteem. Includes reflection prompts, daily affirmations, and progress trackers.',
   'products/placeholder-workbook-1.pdf', 'Self-Esteem-Workbook.pdf',
   14900, 999, 899, 799, 'workbook', true, 0, now(), now()),

  ('dp_anxiety_toolkit', 'Anxiety Management Toolkit', 'anxiety-management-toolkit',
   'Practical exercises and worksheets for managing anxiety in daily life. Features breathing techniques, thought journals, and coping strategy cards.',
   'products/placeholder-toolkit-1.pdf', 'Anxiety-Toolkit.pdf',
   19900, 1299, 1199, 999, 'toolkit', true, 1, now(), now()),

  ('dp_communication_guide', 'Relationship Communication Guide', 'relationship-communication-guide',
   'A couples guide to better communication with structured conversation templates, active listening exercises, and conflict resolution frameworks.',
   'products/placeholder-guide-1.pdf', 'Communication-Guide.pdf',
   9900, 699, 599, 499, 'guide', true, 2, now(), now()),

  ('dp_confidence_journal', 'Confidence Journal Template', 'confidence-journal-template',
   '30-day journaling prompts designed to boost confidence and self-awareness. Print at home and start your transformation journey.',
   'products/placeholder-journal-1.pdf', 'Confidence-Journal.pdf',
   7900, 499, 449, 399, 'journal', true, 3, now(), now()),

  ('dp_boundary_cheatsheet', 'Boundary Setting Cheat Sheet', 'boundary-setting-cheat-sheet',
   'Quick-reference guide for setting healthy boundaries in relationships, at work, and with family. Includes scripts and real-world examples.',
   'products/placeholder-cheatsheet-1.pdf', 'Boundary-Cheat-Sheet.pdf',
   4900, 299, 279, 249, 'cheat_sheet', true, 4, now(), now())
ON CONFLICT (slug) DO NOTHING;

-- Pick-Your-Own Packages (replace/seed alongside existing packages)
INSERT INTO public.hybrid_packages (id, title, slug, description, "priceCents", "priceCentsUsd", "priceCentsEur", "priceCentsGbp", credits, "courseSlots", "digitalProductSlots", "isPublished", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('pkg_starter', 'Starter Bundle', 'starter-bundle',
   'Choose 1 full course and 1 digital product — the perfect way to begin your self-discovery journey.',
   49900, 2999, 2799, 2499, 0, 1, 1, true, 10, now(), now()),

  ('pkg_growth', 'Growth Bundle', 'growth-bundle',
   'Choose 2 full courses and 2 digital products, plus 2 therapy session credits. Everything you need to accelerate your personal growth.',
   149900, 8999, 8499, 7499, 2, 2, 2, true, 11, now(), now()),

  ('pkg_ultimate', 'Ultimate Bundle', 'ultimate-bundle',
   'Choose 3 full courses and 3 digital products, plus 5 therapy session credits. The complete Life-Therapy experience at an unbeatable value.',
   299900, 17999, 16999, 14999, 5, 3, 3, true, 12, now(), now())
ON CONFLICT (slug) DO NOTHING;
