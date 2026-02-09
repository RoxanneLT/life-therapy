-- =============================================================================
-- Patch Migration: Add missing columns from schema changes
-- =============================================================================
-- Run in Supabase SQL Editor. Idempotent (safe to run multiple times).
-- Covers columns added to Prisma schema but missing from prior migrations.
-- =============================================================================

-- 1. COUPONS: packageIds, maxUsesPerUser, minOrderCents
-- Added during Packages/Digital Products feature
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

-- 2. ORDERS: refundedAt
-- Tracks when an order was refunded
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMPTZ;

-- 3. GIFTS: redeemToken, redeemedAt
-- Core gift redemption columns (may already exist from initial schema push)
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

-- 4. HYBRID_PACKAGES: credits
-- Session credits included in package (may already exist from initial schema push)
ALTER TABLE public.hybrid_packages
  ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- Done! Run enable-rls.sql after if you haven't recently.
-- =============================================================================
