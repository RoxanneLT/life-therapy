-- Update Hero Images: Branded BG colours per product type
-- Courses → gray, Packages → green, Digital Products → orange (future)
-- Run in Supabase SQL Editor. Idempotent: safe to run multiple times.

-- ============================================================
-- 1. Set course images to gray BG
-- ============================================================
UPDATE courses SET "imageUrl" = '/images/LT_grayBG.png';

-- ============================================================
-- 2. Set standalone module images to gray BG (short courses)
-- ============================================================
UPDATE modules
  SET "standaloneImageUrl" = '/images/LT_grayBG.png'
  WHERE "isStandalonePublished" = true
    AND ("standaloneImageUrl" IS NULL OR "standaloneImageUrl" = '');

-- ============================================================
-- 3. Set package images to green BG
-- ============================================================
UPDATE hybrid_packages SET "imageUrl" = '/images/LT_greenBG.png';

-- NOTE: CMS page hero sections are NOT updated here.
-- The branded BG images are only for product cards/thumbnails.
-- Page hero backgrounds are managed separately via the admin CMS.
