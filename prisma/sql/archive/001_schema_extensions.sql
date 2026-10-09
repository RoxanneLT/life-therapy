-- =============================================================================
-- 001: Schema Extensions — Multi-Region, Recurring Bookings, Patch Columns
-- =============================================================================
-- Idempotent: safe to run multiple times.
-- Covers: international price columns, recurring booking fields,
--         and miscellaneous column patches added after initial schema push.
-- =============================================================================

-- ============================================================
-- Multi-Region & Multi-Currency
-- ============================================================

-- Course: international price columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'priceUsd') THEN
    ALTER TABLE courses ADD COLUMN "priceUsd" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'priceEur') THEN
    ALTER TABLE courses ADD COLUMN "priceEur" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'courses' AND column_name = 'priceGbp') THEN
    ALTER TABLE courses ADD COLUMN "priceGbp" INTEGER;
  END IF;
END $$;

-- Module: international standalone price columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'standalonePriceUsd') THEN
    ALTER TABLE modules ADD COLUMN "standalonePriceUsd" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'standalonePriceEur') THEN
    ALTER TABLE modules ADD COLUMN "standalonePriceEur" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'standalonePriceGbp') THEN
    ALTER TABLE modules ADD COLUMN "standalonePriceGbp" INTEGER;
  END IF;
END $$;

-- HybridPackage: international price columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hybrid_packages' AND column_name = 'priceCentsUsd') THEN
    ALTER TABLE hybrid_packages ADD COLUMN "priceCentsUsd" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hybrid_packages' AND column_name = 'priceCentsEur') THEN
    ALTER TABLE hybrid_packages ADD COLUMN "priceCentsEur" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hybrid_packages' AND column_name = 'priceCentsGbp') THEN
    ALTER TABLE hybrid_packages ADD COLUMN "priceCentsGbp" INTEGER;
  END IF;
END $$;

-- SiteSetting: session pricing (all currencies)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceIndividualZar') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceIndividualZar" INTEGER DEFAULT 85000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceIndividualUsd') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceIndividualUsd" INTEGER DEFAULT 6500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceIndividualEur') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceIndividualEur" INTEGER DEFAULT 5900;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceIndividualGbp') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceIndividualGbp" INTEGER DEFAULT 4900;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceCouplesZar') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceCouplesZar" INTEGER DEFAULT 120000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceCouplesUsd') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceCouplesUsd" INTEGER DEFAULT 9500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceCouplesEur') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceCouplesEur" INTEGER DEFAULT 8500;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'sessionPriceCouplesGbp') THEN
    ALTER TABLE site_settings ADD COLUMN "sessionPriceCouplesGbp" INTEGER DEFAULT 7500;
  END IF;
END $$;

-- Booking: priceCurrency column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'priceCurrency') THEN
    ALTER TABLE bookings ADD COLUMN "priceCurrency" TEXT NOT NULL DEFAULT 'ZAR';
  END IF;
END $$;

-- SessionCreditPack: international price columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_credit_packs' AND column_name = 'priceCentsUsd') THEN
    ALTER TABLE session_credit_packs ADD COLUMN "priceCentsUsd" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_credit_packs' AND column_name = 'priceCentsEur') THEN
    ALTER TABLE session_credit_packs ADD COLUMN "priceCentsEur" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_credit_packs' AND column_name = 'priceCentsGbp') THEN
    ALTER TABLE session_credit_packs ADD COLUMN "priceCentsGbp" INTEGER;
  END IF;
END $$;

-- Seed default international prices for existing data
-- Full courses: $24.99 / €22.99 / £19.99
UPDATE courses SET
  "priceUsd" = 2499,
  "priceEur" = 2299,
  "priceGbp" = 1999
WHERE "priceUsd" IS NULL;

-- Standalone modules: $4.99 / €4.49 / £3.99
UPDATE modules SET
  "standalonePriceUsd" = 499,
  "standalonePriceEur" = 449,
  "standalonePriceGbp" = 399
WHERE "standalonePriceUsd" IS NULL AND "isStandalonePublished" = true;

-- ============================================================
-- Recurring Booking Fields
-- ============================================================

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recurringSeriesId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recurringPattern" TEXT;
CREATE INDEX IF NOT EXISTS "bookings_recurringSeriesId_idx" ON "bookings" ("recurringSeriesId");

-- ============================================================
-- Patch: Missing Columns (post-initial-schema)
-- ============================================================

-- COUPONS: packageIds, maxUsesPerUser, minOrderCents
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS "packageIds" JSONB;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS "minOrderCents" INTEGER;

-- COUPONS: Multi-currency values for fixed_amount coupons
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS "valueUsd" INTEGER;
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS "valueEur" INTEGER;
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS "valueGbp" INTEGER;

-- ORDERS: refundedAt
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMPTZ;

-- GIFTS: redeemToken, redeemedAt
ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS "redeemedAt" TIMESTAMPTZ;

ALTER TABLE public.gifts
  ADD COLUMN IF NOT EXISTS "redeemToken" TEXT;

-- Set default for redeemToken on rows that don't have one
UPDATE public.gifts
SET "redeemToken" = gen_random_uuid()::text
WHERE "redeemToken" IS NULL;

-- Add unique constraint on redeemToken if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'gifts_redeemToken_key'
  ) THEN
    ALTER TABLE public.gifts ADD CONSTRAINT "gifts_redeemToken_key" UNIQUE ("redeemToken");
  END IF;
END $$;

-- HYBRID_PACKAGES: credits
ALTER TABLE public.hybrid_packages
  ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;
