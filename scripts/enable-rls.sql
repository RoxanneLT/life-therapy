-- =============================================================================
-- Enable RLS + deny-all policies on ALL tables in public schema
-- =============================================================================
-- Dynamic: automatically covers every table (existing + future).
-- Idempotent: safe to run multiple times (skips existing policies).
-- Service_role (used by Prisma) bypasses RLS — app is unaffected.
-- =============================================================================

DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);

    -- Deny-all policy for anon (skip if already exists)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl.tablename AND policyname = 'deny_all_anon'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "deny_all_anon" ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
        tbl.tablename
      );
    END IF;

    -- Deny-all policy for authenticated (skip if already exists)
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
