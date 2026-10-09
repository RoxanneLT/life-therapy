-- =============================================================================
-- 00_types: the schema and every enum
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS "public";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'AdminRole') THEN
    CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'editor', 'marketing');
  END IF;
END $$;
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'marketing';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'BookingStatus') THEN
    CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
  END IF;
END $$;
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'no_show';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'SessionType') THEN
    CREATE TYPE "SessionType" AS ENUM ('free_consultation', 'individual', 'couples');
  END IF;
END $$;
ALTER TYPE "SessionType" ADD VALUE IF NOT EXISTS 'free_consultation';
ALTER TYPE "SessionType" ADD VALUE IF NOT EXISTS 'individual';
ALTER TYPE "SessionType" ADD VALUE IF NOT EXISTS 'couples';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'SessionMode') THEN
    CREATE TYPE "SessionMode" AS ENUM ('online', 'in_person');
  END IF;
END $$;
ALTER TYPE "SessionMode" ADD VALUE IF NOT EXISTS 'online';
ALTER TYPE "SessionMode" ADD VALUE IF NOT EXISTS 'in_person';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'LectureType') THEN
    CREATE TYPE "LectureType" AS ENUM ('video', 'text', 'quiz');
  END IF;
END $$;
ALTER TYPE "LectureType" ADD VALUE IF NOT EXISTS 'video';
ALTER TYPE "LectureType" ADD VALUE IF NOT EXISTS 'text';
ALTER TYPE "LectureType" ADD VALUE IF NOT EXISTS 'quiz';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'QuestionType') THEN
    CREATE TYPE "QuestionType" AS ENUM ('multiple_choice', 'true_false', 'reflection');
  END IF;
END $$;
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'multiple_choice';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'true_false';
ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'reflection';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'OrderStatus') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
  END IF;
END $$;
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'partially_refunded';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'EnrollmentSource') THEN
    CREATE TYPE "EnrollmentSource" AS ENUM ('purchase', 'gift', 'admin_grant', 'upgrade');
  END IF;
END $$;
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'purchase';
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'gift';
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'admin_grant';
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'upgrade';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'CreditTransactionType') THEN
    CREATE TYPE "CreditTransactionType" AS ENUM ('purchase', 'used', 'refund', 'admin_grant', 'gift_received', 'expired');
  END IF;
END $$;
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'purchase';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'used';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'refund';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'admin_grant';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'gift_received';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'expired';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'GiftStatus') THEN
    CREATE TYPE "GiftStatus" AS ENUM ('pending', 'delivered', 'redeemed', 'cancelled');
  END IF;
END $$;
ALTER TYPE "GiftStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "GiftStatus" ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE "GiftStatus" ADD VALUE IF NOT EXISTS 'redeemed';
ALTER TYPE "GiftStatus" ADD VALUE IF NOT EXISTS 'cancelled';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'CouponType') THEN
    CREATE TYPE "CouponType" AS ENUM ('percentage', 'fixed_amount');
  END IF;
END $$;
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'percentage';
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'fixed_amount';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'CampaignStatus') THEN
    CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'active', 'sending', 'sent', 'completed', 'paused', 'failed');
  END IF;
END $$;
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'sending';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'failed';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'DripEmailType') THEN
    CREATE TYPE "DripEmailType" AS ENUM ('onboarding', 'newsletter');
  END IF;
END $$;
ALTER TYPE "DripEmailType" ADD VALUE IF NOT EXISTS 'onboarding';
ALTER TYPE "DripEmailType" ADD VALUE IF NOT EXISTS 'newsletter';
