-- =============================================================================
-- 60_commerce: Commerce — orders, carts, coupons, gifts, packages, digital products, access grants
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── orders ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "couponId" TEXT,
    "paystackReference" TEXT,
    "paystackAccessCode" TEXT,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "orders"("orderNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "orders_paystackReference_key" ON "orders"("paystackReference");

CREATE INDEX IF NOT EXISTS "orders_studentId_idx" ON "orders"("studentId");

CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");

-- ── order_items ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courseId" TEXT,
    "hybridPackageId" TEXT,
    "moduleId" TEXT,
    "digitalProductId" TEXT,
    "packageSelections" JSONB,
    "description" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER NOT NULL,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "giftId" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_items_giftId_key" ON "order_items"("giftId");

CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");

-- ── gifts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "gifts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "message" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "status" "GiftStatus" NOT NULL DEFAULT 'pending',
    "courseId" TEXT,
    "hybridPackageId" TEXT,
    "moduleId" TEXT,
    "digitalProductId" TEXT,
    "packageSelections" JSONB,
    "creditAmount" INTEGER,
    "emailSentAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gifts_redeemToken_key" ON "gifts"("redeemToken");

CREATE INDEX IF NOT EXISTS "gifts_recipientEmail_idx" ON "gifts"("recipientEmail");

CREATE INDEX IF NOT EXISTS "gifts_status_idx" ON "gifts"("status");

-- ── coupons ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL,
    "valueUsd" INTEGER,
    "valueEur" INTEGER,
    "valueGbp" INTEGER,
    "appliesToAll" BOOLEAN NOT NULL DEFAULT true,
    "courseIds" JSONB,
    "packageIds" JSONB,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
    "minOrderCents" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");

-- ── carts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "carts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "carts_studentId_key" ON "carts"("studentId");

-- ── cart_items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "courseId" TEXT,
    "hybridPackageId" TEXT,
    "moduleId" TEXT,
    "digitalProductId" TEXT,
    "packageSelections" JSONB,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "giftRecipientName" TEXT,
    "giftRecipientEmail" TEXT,
    "giftMessage" TEXT,
    "giftDeliveryDate" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cart_items_cartId_idx" ON "cart_items"("cartId");

-- ── hybrid_packages ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "hybrid_packages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "priceCents" INTEGER NOT NULL,
    "priceCentsUsd" INTEGER,
    "priceCentsEur" INTEGER,
    "priceCentsGbp" INTEGER,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "courseSlots" INTEGER NOT NULL DEFAULT 0,
    "digitalProductSlots" INTEGER NOT NULL DEFAULT 0,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "fixedCourseIds" JSONB NOT NULL DEFAULT '[]',
    "fixedModuleIds" JSONB NOT NULL DEFAULT '[]',
    "fixedDigitalProductIds" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hybrid_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hybrid_packages_slug_key" ON "hybrid_packages"("slug");

-- ── digital_products ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "digital_products" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "priceCentsUsd" INTEGER,
    "priceCentsEur" INTEGER,
    "priceCentsGbp" INTEGER,
    "category" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_products_pkey" PRIMARY KEY ("id")
);

-- Production had a gen_random_uuid() default the app never used: Prisma always supplies the id.
ALTER TABLE "digital_products" ALTER COLUMN "id" DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS "digital_products_slug_key" ON "digital_products"("slug");

-- ── digital_product_access ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "digital_product_access" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "digitalProductId" TEXT NOT NULL,
    "orderId" TEXT,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'purchase',
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_product_access_pkey" PRIMARY KEY ("id")
);

-- Production had a gen_random_uuid() default the app never used: Prisma always supplies the id.
ALTER TABLE "digital_product_access" ALTER COLUMN "id" DROP DEFAULT;

-- Created as TEXT by the old 002_ecommerce.sql while the schema said EnrollmentSource. Converted
-- in place (Prisma's own diff drops and re-adds the column, which would erase the values).
-- Every value present on 2026-10-09 was in the enum: purchase, gift.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'digital_product_access' AND column_name = 'source' AND udt_name = 'text') THEN
    ALTER TABLE "digital_product_access" ALTER COLUMN "source" DROP DEFAULT;
    ALTER TABLE "digital_product_access" ALTER COLUMN "source" TYPE "EnrollmentSource" USING "source"::"EnrollmentSource";
    ALTER TABLE "digital_product_access" ALTER COLUMN "source" SET DEFAULT 'purchase';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."dpa_studentid_idx"') IS NOT NULL AND to_regclass('public."digital_product_access_studentId_idx"') IS NULL THEN
    ALTER INDEX "dpa_studentid_idx" RENAME TO "digital_product_access_studentId_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "digital_product_access_studentId_idx" ON "digital_product_access"("studentId");

DO $$ BEGIN
  IF to_regclass('public."dpa_digitalproductid_idx"') IS NOT NULL AND to_regclass('public."digital_product_access_digitalProductId_idx"') IS NULL THEN
    ALTER INDEX "dpa_digitalproductid_idx" RENAME TO "digital_product_access_digitalProductId_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "digital_product_access_digitalProductId_idx" ON "digital_product_access"("digitalProductId");

DO $$ BEGIN
  IF to_regclass('public."dpa_student_product_unique"') IS NOT NULL AND to_regclass('public."digital_product_access_studentId_digitalProductId_key"') IS NULL THEN
    ALTER INDEX "dpa_student_product_unique" RENAME TO "digital_product_access_studentId_digitalProductId_key";
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "digital_product_access_studentId_digitalProductId_key" ON "digital_product_access"("studentId", "digitalProductId");

-- ── module_access ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "module_access" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "orderId" TEXT,
    "pricePaid" INTEGER NOT NULL DEFAULT 0,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'purchase',
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_access_pkey" PRIMARY KEY ("id")
);

-- Production had a gen_random_uuid() default the app never used: Prisma always supplies the id.
ALTER TABLE "module_access" ALTER COLUMN "id" DROP DEFAULT;

-- Created as TEXT by the old 002_ecommerce.sql while the schema said EnrollmentSource. Converted
-- in place (Prisma's own diff drops and re-adds the column, which would erase the values).
-- Every value present on 2026-10-09 was in the enum: purchase, gift.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'module_access' AND column_name = 'source' AND udt_name = 'text') THEN
    ALTER TABLE "module_access" ALTER COLUMN "source" DROP DEFAULT;
    ALTER TABLE "module_access" ALTER COLUMN "source" TYPE "EnrollmentSource" USING "source"::"EnrollmentSource";
    ALTER TABLE "module_access" ALTER COLUMN "source" SET DEFAULT 'purchase';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public."module_access_studentid_idx"') IS NOT NULL AND to_regclass('public."module_access_studentId_idx"') IS NULL THEN
    ALTER INDEX "module_access_studentid_idx" RENAME TO "module_access_studentId_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "module_access_studentId_idx" ON "module_access"("studentId");

DO $$ BEGIN
  IF to_regclass('public."module_access_moduleid_idx"') IS NOT NULL AND to_regclass('public."module_access_moduleId_idx"') IS NULL THEN
    ALTER INDEX "module_access_moduleid_idx" RENAME TO "module_access_moduleId_idx";
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "module_access_moduleId_idx" ON "module_access"("moduleId");

DO $$ BEGIN
  IF to_regclass('public."module_access_student_module_unique"') IS NOT NULL AND to_regclass('public."module_access_studentId_moduleId_key"') IS NULL THEN
    ALTER INDEX "module_access_student_module_unique" RENAME TO "module_access_studentId_moduleId_key";
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "module_access_studentId_moduleId_key" ON "module_access"("studentId", "moduleId");

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_orderId_fkey' AND conrelid = 'public."enrollments"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_orderId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_orderId_fkey' AND conrelid = 'public."enrollments"'::regclass) THEN
    ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_access_studentId_fkey' AND conrelid = 'public."module_access"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "module_access" DROP CONSTRAINT "module_access_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_access_studentId_fkey' AND conrelid = 'public."module_access"'::regclass) THEN
    ALTER TABLE "module_access" ADD CONSTRAINT "module_access_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_access_moduleId_fkey' AND conrelid = 'public."module_access"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "module_access" DROP CONSTRAINT "module_access_moduleId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_access_moduleId_fkey' AND conrelid = 'public."module_access"'::regclass) THEN
    ALTER TABLE "module_access" ADD CONSTRAINT "module_access_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_access_courseId_fkey' AND conrelid = 'public."module_access"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "module_access" DROP CONSTRAINT "module_access_courseId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_access_courseId_fkey' AND conrelid = 'public."module_access"'::regclass) THEN
    ALTER TABLE "module_access" ADD CONSTRAINT "module_access_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_studentId_fkey' AND conrelid = 'public."orders"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "orders" DROP CONSTRAINT "orders_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_studentId_fkey' AND conrelid = 'public."orders"'::regclass) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_couponId_fkey' AND conrelid = 'public."orders"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "orders" DROP CONSTRAINT "orders_couponId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_couponId_fkey' AND conrelid = 'public."orders"'::regclass) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_orderId_fkey' AND conrelid = 'public."order_items"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_orderId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_orderId_fkey' AND conrelid = 'public."order_items"'::regclass) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_courseId_fkey' AND conrelid = 'public."order_items"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_courseId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_courseId_fkey' AND conrelid = 'public."order_items"'::regclass) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_hybridPackageId_fkey' AND conrelid = 'public."order_items"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_hybridPackageId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_hybridPackageId_fkey' AND conrelid = 'public."order_items"'::regclass) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_hybridPackageId_fkey" FOREIGN KEY ("hybridPackageId") REFERENCES "hybrid_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_moduleId_fkey' AND conrelid = 'public."order_items"'::regclass AND (confdeltype <> 'a' OR confupdtype <> 'c')) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_moduleId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_moduleId_fkey' AND conrelid = 'public."order_items"'::regclass) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_digitalProductId_fkey' AND conrelid = 'public."order_items"'::regclass AND (confdeltype <> 'a' OR confupdtype <> 'c')) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_digitalProductId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_digitalProductId_fkey' AND conrelid = 'public."order_items"'::regclass) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_digitalProductId_fkey" FOREIGN KEY ("digitalProductId") REFERENCES "digital_products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_giftId_fkey' AND conrelid = 'public."order_items"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "order_items" DROP CONSTRAINT "order_items_giftId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_giftId_fkey' AND conrelid = 'public."order_items"'::regclass) THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_orderId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_orderId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_orderId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_buyerId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_buyerId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_buyerId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_recipientId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_recipientId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_recipientId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_courseId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_courseId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_courseId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_hybridPackageId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_hybridPackageId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_hybridPackageId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_hybridPackageId_fkey" FOREIGN KEY ("hybridPackageId") REFERENCES "hybrid_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_moduleId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'a' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_moduleId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_moduleId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_digitalProductId_fkey' AND conrelid = 'public."gifts"'::regclass AND (confdeltype <> 'a' OR confupdtype <> 'c')) THEN
    ALTER TABLE "gifts" DROP CONSTRAINT "gifts_digitalProductId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_digitalProductId_fkey' AND conrelid = 'public."gifts"'::regclass) THEN
    ALTER TABLE "gifts" ADD CONSTRAINT "gifts_digitalProductId_fkey" FOREIGN KEY ("digitalProductId") REFERENCES "digital_products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carts_studentId_fkey' AND conrelid = 'public."carts"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "carts" DROP CONSTRAINT "carts_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carts_studentId_fkey' AND conrelid = 'public."carts"'::regclass) THEN
    ALTER TABLE "carts" ADD CONSTRAINT "carts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cartId_fkey' AND conrelid = 'public."cart_items"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_cartId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cartId_fkey' AND conrelid = 'public."cart_items"'::regclass) THEN
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_digitalProductId_fkey' AND conrelid = 'public."cart_items"'::regclass AND (confdeltype <> 'a' OR confupdtype <> 'c')) THEN
    ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_digitalProductId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_digitalProductId_fkey' AND conrelid = 'public."cart_items"'::regclass) THEN
    ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_digitalProductId_fkey" FOREIGN KEY ("digitalProductId") REFERENCES "digital_products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'digital_product_access_studentId_fkey' AND conrelid = 'public."digital_product_access"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "digital_product_access" DROP CONSTRAINT "digital_product_access_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'digital_product_access_studentId_fkey' AND conrelid = 'public."digital_product_access"'::regclass) THEN
    ALTER TABLE "digital_product_access" ADD CONSTRAINT "digital_product_access_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'digital_product_access_digitalProductId_fkey' AND conrelid = 'public."digital_product_access"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "digital_product_access" DROP CONSTRAINT "digital_product_access_digitalProductId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'digital_product_access_digitalProductId_fkey' AND conrelid = 'public."digital_product_access"'::regclass) THEN
    ALTER TABLE "digital_product_access" ADD CONSTRAINT "digital_product_access_digitalProductId_fkey" FOREIGN KEY ("digitalProductId") REFERENCES "digital_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
