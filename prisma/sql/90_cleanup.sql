-- =============================================================================
-- 90_cleanup: removals — what production still carries and the schema no longer has
-- =============================================================================
-- IDEMPOTENT: every statement is IF EXISTS, so after the first run this file is a no-op.
-- Runs after the domain groups (nothing above depends on what goes here) and before 99_security.
--
-- A removal is never the default (.claude/rules/schema-changes.md): each block names the owner's
-- ruling, the date, and what the rows were, so a future reader can tell a decision from an accident.
-- =============================================================================

-- ── 2026-10-09 · retired bundles, credit packs and the old contacts table ──────────
-- Owner's ruling 2026-10-09 ("drop"), on the drift found that day. None of these is in
-- schema.prisma, and no code reads them (grep of app/, lib/, components/, scripts/).
-- Contents when dropped: bundles 5 rows, bundle_courses 12 rows — exported first to
-- ~/OneDrive/dev-secrets/life-therapy/backups/2026-10-09-bundles.json. Every other table and every
-- column below was empty (all 7 columns NULL in every row).

-- Columns first: dropping a column drops the foreign key it carried to "bundles".
ALTER TABLE "order_items"     DROP COLUMN IF EXISTS "bundleId", DROP COLUMN IF EXISTS "creditPackId";
ALTER TABLE "gifts"           DROP COLUMN IF EXISTS "bundleId", DROP COLUMN IF EXISTS "creditPackId";
ALTER TABLE "cart_items"      DROP COLUMN IF EXISTS "bundleId", DROP COLUMN IF EXISTS "creditPackId";
ALTER TABLE "coupons"         DROP COLUMN IF EXISTS "bundleIds";
ALTER TABLE "hybrid_packages" DROP COLUMN IF EXISTS "documentUrl";

-- bundle_courses references bundles, so it goes first. No CASCADE: if anything else had come to
-- depend on these tables, this should fail and be read, not silently take it along.
DROP TABLE IF EXISTS "bundle_courses";
DROP TABLE IF EXISTS "bundles";
DROP TABLE IF EXISTS "hybrid_package_courses";
DROP TABLE IF EXISTS "session_credit_packs";
DROP TABLE IF EXISTS "contacts";   -- merged into students in Feb 2026; empty since

DROP TYPE IF EXISTS "ContactSource"; -- used only by contacts.source
