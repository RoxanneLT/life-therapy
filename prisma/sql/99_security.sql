-- =============================================================================
-- 99_security: Row Level Security on every table in public — ALWAYS LAST
-- =============================================================================
-- IDEMPOTENT: enables RLS and adds the two deny-all policies only where missing.
-- Dynamic: covers every table in public, including any a group above has just created, which is
-- why it runs last.
--
-- What it protects: the anon and authenticated roles are what the Supabase public key speaks as.
-- Denying them everything means the public key can read or change nothing directly. The app is
-- unaffected: Prisma connects as the table owner, which RLS does not apply to, and nothing in
-- the app reads tables through supabase-js (`.from()` is used nowhere; Supabase is auth only).
--
-- 2026-10-09: `rate_limits` had RLS OFF (Supabase advisor, critical) and three other tables lacked
-- the policies; 57 of 61 had them. Owner's ruling that day: fix. Re-running this file is the fix.
-- Carried from the old 005_security.sql unchanged in substance.
-- =============================================================================

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl.tablename AND policyname = 'deny_all_anon'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "deny_all_anon" ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        tbl.tablename
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl.tablename AND policyname = 'deny_all_authenticated'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "deny_all_authenticated" ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
        tbl.tablename
      );
    END IF;
  END LOOP;
END $$;
