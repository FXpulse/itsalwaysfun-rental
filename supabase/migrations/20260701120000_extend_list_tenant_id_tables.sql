-- Extend list_tenant_id_tables() to also report whether the tenant_id
-- column is NOT NULL and whether it has a DEFAULT expression.
--
-- Motivation (2026-07-01):
--   Live incident — driver hit `null value in column "tenant_id" of
--   relation "booking_proofs" violates not null constraint` while
--   capturing delivery signature. Root cause: the table shipped
--   `tenant_id NOT NULL DEFAULT '11111111-...'`, and later
--   drop_default_tenant_id.sql removed the default (correct hygiene
--   for multi-tenant safety) — but nobody updated lib/tenant/scope.ts,
--   so booking_proofs remained listed under INTENTIONALLY_NOT_SCOPED
--   and the proxy did NOT auto-inject tenant_id on insert.
--
--   Every insert on that table then threw the NOT NULL violation. Six
--   sibling tables (booking_damages, booking_waivers, booking_extensions,
--   coi_requests, booking_expense_categories, booking_expenses) had the
--   same latent bug, waiting for the next code path to trigger it.
--
-- What this enables:
--   scripts/check-tenant-scope.ts gains a new Check #5 —
--   "tenant_id NOT NULL without default AND listed in
--    INTENTIONALLY_NOT_SCOPED" is now a CI failure. The exact class of
--   bug that hit prod today gets caught before the next merge.
--
-- Backwards compatible: existing callers of list_tenant_id_tables()
-- that only read table_name / rls_enabled keep working — Postgres
-- allows adding columns to a RETURNS TABLE via CREATE OR REPLACE only
-- when the existing columns keep their names and types (they do).

CREATE OR REPLACE FUNCTION public.list_tenant_id_tables()
RETURNS TABLE(
  table_name  text,
  rls_enabled bool,
  is_not_null bool,
  has_default bool
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    c.table_name::text,
    COALESCE(
      (SELECT pt.rowsecurity FROM pg_tables pt
        WHERE pt.schemaname = 'public' AND pt.tablename = c.table_name),
      false
    )                                              AS rls_enabled,
    (c.is_nullable = 'NO')                         AS is_not_null,
    (c.column_default IS NOT NULL)                 AS has_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.column_name  = 'tenant_id'
  ORDER BY c.table_name;
$$;

REVOKE ALL ON FUNCTION public.list_tenant_id_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_tenant_id_tables() TO service_role;
