-- =============================================================================
-- Migration: Sellable Modules (Short Courses) + Preview Videos
-- =============================================================================
-- Run this in Supabase SQL Editor to apply schema changes.
-- Safe to run multiple times (uses IF NOT EXISTS checks).
-- RLS is handled separately by enable-rls.sql (run that after).
-- =============================================================================

-- ─── NEW TABLE: module_access ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.module_access (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "studentId" TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  "moduleId" TEXT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  "courseId" TEXT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  "orderId" TEXT,
  "pricePaid" INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'purchase',
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT module_access_student_module_unique UNIQUE ("studentId", "moduleId")
);

CREATE INDEX IF NOT EXISTS module_access_studentId_idx ON public.module_access ("studentId");
CREATE INDEX IF NOT EXISTS module_access_moduleId_idx ON public.module_access ("moduleId");

-- ─── ALTER TABLE: courses (add 3 columns) ──────────────────────────────────

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS "previewVideoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "facilitatorScript" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedCourseIds" JSONB;

-- ─── ALTER TABLE: modules (add 9 columns) ──────────────────────────────────

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS "standaloneSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "standaloneTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "standaloneDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "standaloneImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "standalonePrice" INTEGER,
  ADD COLUMN IF NOT EXISTS "isStandalonePublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "standaloneCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "previewVideoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "facilitatorScript" TEXT;

-- Unique index on standaloneSlug (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS modules_standaloneSlug_unique
  ON public.modules ("standaloneSlug")
  WHERE "standaloneSlug" IS NOT NULL;

-- ─── ALTER TABLE: lectures (add context column) ─────────────────────────────

ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'both';

-- ─── ALTER TABLE: cart_items (add moduleId) ─────────────────────────────────

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS "moduleId" TEXT;

-- ─── ALTER TABLE: order_items (add moduleId + FK) ───────────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS "moduleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_moduleId_fkey'
      AND table_name = 'order_items'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT "order_items_moduleId_fkey"
      FOREIGN KEY ("moduleId") REFERENCES public.modules(id);
  END IF;
END $$;

-- ─── ALTER TABLE: gifts (add moduleId + FK) ─────────────────────────────────

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS "moduleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'gifts_moduleId_fkey'
      AND table_name = 'gifts'
  ) THEN
    ALTER TABLE public.gifts
      ADD CONSTRAINT "gifts_moduleId_fkey"
      FOREIGN KEY ("moduleId") REFERENCES public.modules(id);
  END IF;
END $$;
