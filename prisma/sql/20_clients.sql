-- =============================================================================
-- 20_clients: Clients — students, notes, intakes, relationships and invites, commitments, document acceptances
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── students ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "students" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "emailOptOut" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribeToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "branch" TEXT,
    "relationshipStatus" TEXT,
    "emergencyContact" TEXT,
    "referralSource" TEXT,
    "referralDetail" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "profileCompletedAt" TIMESTAMP(3),
    "clientStatus" TEXT NOT NULL DEFAULT 'potential',
    "convertedAt" TIMESTAMP(3),
    "convertedBy" TEXT,
    "erasedAt" TIMESTAMP(3),
    "erasedBy" TEXT,
    "retainUntil" DATE,
    "source" TEXT NOT NULL DEFAULT 'booking',
    "tags" JSONB,
    "emailPaused" BOOLEAN NOT NULL DEFAULT false,
    "emailPausedAt" TIMESTAMP(3),
    "emailPauseReason" TEXT,
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT true,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "sessionReminders" BOOLEAN NOT NULL DEFAULT true,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentDate" TIMESTAMP(3),
    "consentMethod" TEXT,
    "adminNotes" TEXT,
    "billingType" TEXT NOT NULL DEFAULT 'prepaid',
    "billFullMonth" BOOLEAN NOT NULL DEFAULT true,
    "billingEmail" TEXT,
    "billingAddress" TEXT,
    "standingDiscountPercent" DOUBLE PRECISION,
    "standingDiscountFixed" INTEGER,
    "individualBilledToId" TEXT,
    "couplesBilledToId" TEXT,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "students_supabaseUserId_key" ON "students"("supabaseUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "students_email_key" ON "students"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "students_unsubscribeToken_key" ON "students"("unsubscribeToken");

CREATE INDEX IF NOT EXISTS "students_clientStatus_idx" ON "students"("clientStatus");

CREATE INDEX IF NOT EXISTS "students_source_idx" ON "students"("source");

CREATE INDEX IF NOT EXISTS "students_emailPaused_idx" ON "students"("emailPaused");

-- POPIA erasure (owner's ruling, 2026-10-09). A client is anonymised in place, never deleted:
-- erasedAt/erasedBy record when and by which admin; retainUntil is the day the clinical records
-- kept under the privacy policy's 5-year rule may be purged (lib/popia/). Added to an existing
-- table, so the CREATE above cannot carry them to production.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "erasedAt" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "erasedBy" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "retainUntil" DATE;

-- ── student_notes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "student_notes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_notes_studentId_lectureId_idx" ON "student_notes"("studentId", "lectureId");

-- ── client_intakes ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "client_intakes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "behaviours" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feelings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "otherBehaviours" TEXT,
    "otherFeelings" TEXT,
    "otherSymptoms" TEXT,
    "additionalNotes" TEXT,
    "adminNotes" TEXT,
    "lastEditedBy" TEXT,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_intakes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "client_intakes_studentId_key" ON "client_intakes"("studentId");

-- ── client_relationships ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "client_relationships" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relatedStudentId" TEXT,
    "billingEntityId" TEXT,
    "relationshipType" TEXT NOT NULL,
    "relationshipLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_relationships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "client_relationships_studentId_idx" ON "client_relationships"("studentId");

CREATE INDEX IF NOT EXISTS "client_relationships_relatedStudentId_idx" ON "client_relationships"("relatedStudentId");

CREATE INDEX IF NOT EXISTS "client_relationships_billingEntityId_idx" ON "client_relationships"("billingEntityId");

CREATE UNIQUE INDEX IF NOT EXISTS "client_relationships_studentId_relatedStudentId_key" ON "client_relationships"("studentId", "relatedStudentId");

-- ── relationship_invites ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "relationship_invites" (
    "id" TEXT NOT NULL,
    "fromStudentId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "toStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "relationship_invites_token_key" ON "relationship_invites"("token");

CREATE INDEX IF NOT EXISTS "relationship_invites_fromStudentId_idx" ON "relationship_invites"("fromStudentId");

CREATE INDEX IF NOT EXISTS "relationship_invites_toEmail_idx" ON "relationship_invites"("toEmail");

CREATE INDEX IF NOT EXISTS "relationship_invites_toStudentId_idx" ON "relationship_invites"("toStudentId");

CREATE INDEX IF NOT EXISTS "relationship_invites_token_idx" ON "relationship_invites"("token");

-- ── commitment_acknowledgements ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "commitment_acknowledgements" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commitment_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commitment_acknowledgements_studentId_version_key" ON "commitment_acknowledgements"("studentId", "version");

-- ── document_acceptances ──────────────────────────────────────────────────

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

CREATE INDEX IF NOT EXISTS "document_acceptances_studentId_documentSlug_idx" ON "document_acceptances"("studentId", "documentSlug");

CREATE UNIQUE INDEX IF NOT EXISTS "document_acceptances_studentId_documentSlug_documentVersion_key" ON "document_acceptances"("studentId", "documentSlug", "documentVersion");

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_individualBilledToId_fkey' AND conrelid = 'public."students"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "students" DROP CONSTRAINT "students_individualBilledToId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_individualBilledToId_fkey' AND conrelid = 'public."students"'::regclass) THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_individualBilledToId_fkey" FOREIGN KEY ("individualBilledToId") REFERENCES "client_relationships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_couplesBilledToId_fkey' AND conrelid = 'public."students"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "students" DROP CONSTRAINT "students_couplesBilledToId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_couplesBilledToId_fkey' AND conrelid = 'public."students"'::regclass) THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_couplesBilledToId_fkey" FOREIGN KEY ("couplesBilledToId") REFERENCES "client_relationships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_notes_studentId_fkey' AND conrelid = 'public."student_notes"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "student_notes" DROP CONSTRAINT "student_notes_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_notes_studentId_fkey' AND conrelid = 'public."student_notes"'::regclass) THEN
    ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relationships_studentId_fkey' AND conrelid = 'public."client_relationships"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "client_relationships" DROP CONSTRAINT "client_relationships_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relationships_studentId_fkey' AND conrelid = 'public."client_relationships"'::regclass) THEN
    ALTER TABLE "client_relationships" ADD CONSTRAINT "client_relationships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relationships_relatedStudentId_fkey' AND conrelid = 'public."client_relationships"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "client_relationships" DROP CONSTRAINT "client_relationships_relatedStudentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relationships_relatedStudentId_fkey' AND conrelid = 'public."client_relationships"'::regclass) THEN
    ALTER TABLE "client_relationships" ADD CONSTRAINT "client_relationships_relatedStudentId_fkey" FOREIGN KEY ("relatedStudentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_invites_fromStudentId_fkey' AND conrelid = 'public."relationship_invites"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "relationship_invites" DROP CONSTRAINT "relationship_invites_fromStudentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_invites_fromStudentId_fkey' AND conrelid = 'public."relationship_invites"'::regclass) THEN
    ALTER TABLE "relationship_invites" ADD CONSTRAINT "relationship_invites_fromStudentId_fkey" FOREIGN KEY ("fromStudentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_invites_toStudentId_fkey' AND conrelid = 'public."relationship_invites"'::regclass AND (confdeltype <> 'n' OR confupdtype <> 'c')) THEN
    ALTER TABLE "relationship_invites" DROP CONSTRAINT "relationship_invites_toStudentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_invites_toStudentId_fkey' AND conrelid = 'public."relationship_invites"'::regclass) THEN
    ALTER TABLE "relationship_invites" ADD CONSTRAINT "relationship_invites_toStudentId_fkey" FOREIGN KEY ("toStudentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_intakes_studentId_fkey' AND conrelid = 'public."client_intakes"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "client_intakes" DROP CONSTRAINT "client_intakes_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_intakes_studentId_fkey' AND conrelid = 'public."client_intakes"'::regclass) THEN
    ALTER TABLE "client_intakes" ADD CONSTRAINT "client_intakes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commitment_acknowledgements_studentId_fkey' AND conrelid = 'public."commitment_acknowledgements"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "commitment_acknowledgements" DROP CONSTRAINT "commitment_acknowledgements_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commitment_acknowledgements_studentId_fkey' AND conrelid = 'public."commitment_acknowledgements"'::regclass) THEN
    ALTER TABLE "commitment_acknowledgements" ADD CONSTRAINT "commitment_acknowledgements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_acceptances_studentId_fkey' AND conrelid = 'public."document_acceptances"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "document_acceptances" DROP CONSTRAINT "document_acceptances_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_acceptances_studentId_fkey' AND conrelid = 'public."document_acceptances"'::regclass) THEN
    ALTER TABLE "document_acceptances" ADD CONSTRAINT "document_acceptances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_acceptances_documentId_fkey' AND conrelid = 'public."document_acceptances"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "document_acceptances" DROP CONSTRAINT "document_acceptances_documentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_acceptances_documentId_fkey' AND conrelid = 'public."document_acceptances"'::regclass) THEN
    ALTER TABLE "document_acceptances" ADD CONSTRAINT "document_acceptances_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
