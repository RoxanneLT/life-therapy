-- =============================================================================
-- 50_learning: Learning — courses, modules, lectures, quizzes, enrolments, progress, certificates
-- =============================================================================
-- IDEMPOTENT: every statement brings the database TO a state, so re-running the file changes
-- nothing. Applied in order with the other groups by `npm run db:apply` (scripts/db-apply.mjs).
-- A schema change is an edit HERE plus the matching edit to prisma/schema.prisma, in one commit;
-- `npm run db:drift` then proves the two agree. Write it the same way: IF NOT EXISTS, IF EXISTS,
-- or a DO block that checks the catalogue first.
-- Generated 2026-10-09 from schema.prisma (`prisma migrate diff --from-empty`), then hand-kept.
-- =============================================================================

-- ── courses ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "subtitle" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "priceUsd" INTEGER,
    "priceEur" INTEGER,
    "priceGbp" INTEGER,
    "category" TEXT,
    "modulesCount" INTEGER NOT NULL DEFAULT 0,
    "hours" TEXT,
    "level" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "previewVideoUrl" TEXT,
    "facilitatorScript" TEXT,
    "relatedCourseIds" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "courses_slug_key" ON "courses"("slug");

-- ── modules ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "standaloneSlug" TEXT,
    "standaloneTitle" TEXT,
    "standaloneDescription" TEXT,
    "standaloneImageUrl" TEXT,
    "standalonePrice" INTEGER,
    "standalonePriceUsd" INTEGER,
    "standalonePriceEur" INTEGER,
    "standalonePriceGbp" INTEGER,
    "isStandalonePublished" BOOLEAN NOT NULL DEFAULT false,
    "standaloneCategory" TEXT,
    "previewVideoUrl" TEXT,
    "facilitatorScript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "modules_standaloneSlug_key" ON "modules"("standaloneSlug");

CREATE INDEX IF NOT EXISTS "modules_courseId_idx" ON "modules"("courseId");

-- ── lectures ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "lectures" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lectureType" "LectureType" NOT NULL DEFAULT 'video',
    "videoUrl" TEXT,
    "textContent" TEXT,
    "worksheetUrl" TEXT,
    "durationSeconds" INTEGER,
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "context" TEXT NOT NULL DEFAULT 'both',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lectures_moduleId_idx" ON "lectures"("moduleId");

-- ── quizzes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quizzes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quizzes_moduleId_key" ON "quizzes"("moduleId");

-- ── quiz_questions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quiz_questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB,
    "explanation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_questions_quizId_idx" ON "quiz_questions"("quizId");

-- ── quiz_attempts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "quiz_attempts" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_attempts_quizId_studentId_idx" ON "quiz_attempts"("quizId", "studentId");

-- ── enrollments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" "EnrollmentSource" NOT NULL DEFAULT 'purchase',
    "orderId" TEXT,
    "giftId" TEXT,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "enrollments_studentId_idx" ON "enrollments"("studentId");

CREATE INDEX IF NOT EXISTS "enrollments_courseId_idx" ON "enrollments"("courseId");

CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_studentId_courseId_key" ON "enrollments"("studentId", "courseId");

-- ── lecture_progress ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "lecture_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "videoPosition" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_progress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "lecture_progress_studentId_idx" ON "lecture_progress"("studentId");

CREATE UNIQUE INDEX IF NOT EXISTS "lecture_progress_studentId_lectureId_key" ON "lecture_progress"("studentId", "lectureId");

-- ── certificates ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "certificates" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_certificateNumber_key" ON "certificates"("certificateNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "certificates_studentId_courseId_key" ON "certificates"("studentId", "courseId");

-- ── foreign keys ────────────────────────────────────────────────────────
-- Each lives in the later of its two tables' groups, so both exist when it runs. A key whose
-- delete/update rules differ from the schema's is dropped and recreated; a missing one is added.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'modules_courseId_fkey' AND conrelid = 'public."modules"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "modules" DROP CONSTRAINT "modules_courseId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'modules_courseId_fkey' AND conrelid = 'public."modules"'::regclass) THEN
    ALTER TABLE "modules" ADD CONSTRAINT "modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lectures_moduleId_fkey' AND conrelid = 'public."lectures"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "lectures" DROP CONSTRAINT "lectures_moduleId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lectures_moduleId_fkey' AND conrelid = 'public."lectures"'::regclass) THEN
    ALTER TABLE "lectures" ADD CONSTRAINT "lectures_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_moduleId_fkey' AND conrelid = 'public."quizzes"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_moduleId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_moduleId_fkey' AND conrelid = 'public."quizzes"'::regclass) THEN
    ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_quizId_fkey' AND conrelid = 'public."quiz_questions"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "quiz_questions" DROP CONSTRAINT "quiz_questions_quizId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_quizId_fkey' AND conrelid = 'public."quiz_questions"'::regclass) THEN
    ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_quizId_fkey' AND conrelid = 'public."quiz_attempts"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "quiz_attempts" DROP CONSTRAINT "quiz_attempts_quizId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_quizId_fkey' AND conrelid = 'public."quiz_attempts"'::regclass) THEN
    ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_studentId_fkey' AND conrelid = 'public."quiz_attempts"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "quiz_attempts" DROP CONSTRAINT "quiz_attempts_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_studentId_fkey' AND conrelid = 'public."quiz_attempts"'::regclass) THEN
    ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_studentId_fkey' AND conrelid = 'public."enrollments"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_studentId_fkey' AND conrelid = 'public."enrollments"'::regclass) THEN
    ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_courseId_fkey' AND conrelid = 'public."enrollments"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_courseId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_courseId_fkey' AND conrelid = 'public."enrollments"'::regclass) THEN
    ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lecture_progress_studentId_fkey' AND conrelid = 'public."lecture_progress"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "lecture_progress" DROP CONSTRAINT "lecture_progress_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lecture_progress_studentId_fkey' AND conrelid = 'public."lecture_progress"'::regclass) THEN
    ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lecture_progress_lectureId_fkey' AND conrelid = 'public."lecture_progress"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "lecture_progress" DROP CONSTRAINT "lecture_progress_lectureId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lecture_progress_lectureId_fkey' AND conrelid = 'public."lecture_progress"'::regclass) THEN
    ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_studentId_fkey' AND conrelid = 'public."certificates"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "certificates" DROP CONSTRAINT "certificates_studentId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_studentId_fkey' AND conrelid = 'public."certificates"'::regclass) THEN
    ALTER TABLE "certificates" ADD CONSTRAINT "certificates_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_courseId_fkey' AND conrelid = 'public."certificates"'::regclass AND (confdeltype <> 'r' OR confupdtype <> 'c')) THEN
    ALTER TABLE "certificates" DROP CONSTRAINT "certificates_courseId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_courseId_fkey' AND conrelid = 'public."certificates"'::regclass) THEN
    ALTER TABLE "certificates" ADD CONSTRAINT "certificates_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_notes_lectureId_fkey' AND conrelid = 'public."student_notes"'::regclass AND (confdeltype <> 'c' OR confupdtype <> 'c')) THEN
    ALTER TABLE "student_notes" DROP CONSTRAINT "student_notes_lectureId_fkey";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_notes_lectureId_fkey' AND conrelid = 'public."student_notes"'::regclass) THEN
    ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
