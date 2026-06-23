-- RPC used by scripts/check-tenant-scope.ts to enforce "every public table
-- ships with RLS enabled". Returns name + rls status + policy count so the
-- CI script can fail noisily when a new migration drops a table without
-- the ENABLE ROW LEVEL SECURITY line.
--
-- Mirrors the existing list_tenant_id_tables() RPC pattern.

CREATE OR REPLACE FUNCTION public.list_public_tables_rls_status()
RETURNS TABLE(table_name text, rls_enabled boolean, policy_count int)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.relname::text,
    c.relrowsecurity,
    (
      SELECT COUNT(*)::int
        FROM pg_policies p
       WHERE p.schemaname = 'public'
         AND p.tablename = c.relname
    )
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relkind = 'r'
 ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.list_public_tables_rls_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_tables_rls_status() TO service_role;
