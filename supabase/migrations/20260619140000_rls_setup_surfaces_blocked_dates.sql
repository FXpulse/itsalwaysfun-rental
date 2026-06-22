-- Tighten two RLS leaks surfaced by the 2026-06-19 security audit:
--
-- 1) setup_surfaces.tenant_read had USING (true) → any client could read
--    all tenants' setup-surface catalogs (and the table is scoped by
--    (tenant_id, value) unique). Scope the read policy to the current
--    tenant via the existing x-tenant-id header convention used by other
--    tenant_isolation policies in this schema.
--
-- 2) blocked_dates had NO tenant_id column and a public_read policy of
--    USING (true). Direct queries to the table from anon clients (e.g.
--    via Supabase JS) could enumerate all tenants' inventory blocks. Add
--    tenant_id (backfill from products), NOT NULL, FK + index, then
--    replace the policy with a tenant scope.

-- ───────────────────────────────────────────────────────────────────────
-- M8: setup_surfaces tenant scope
-- ───────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tenant read surfaces" ON public.setup_surfaces;

CREATE POLICY "tenant read surfaces" ON public.setup_surfaces
  FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id)::text = COALESCE(
      ((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text),
      ''::text
    )
  );

-- ───────────────────────────────────────────────────────────────────────
-- M9: blocked_dates tenant_id column + scoped RLS
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.blocked_dates
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill from the FK'd product. blocked_dates.product_id is NOT NULL so
-- every row gets a tenant_id from products.tenant_id.
UPDATE public.blocked_dates bd
SET tenant_id = p.tenant_id
FROM public.products p
WHERE bd.product_id = p.id
  AND bd.tenant_id IS NULL;

-- Now enforce. Any new row must carry tenant_id (and it must match the
-- product's tenant — application code is responsible for that, the FK
-- below makes orphans impossible).
ALTER TABLE public.blocked_dates
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.blocked_dates
  DROP CONSTRAINT IF EXISTS blocked_dates_tenant_id_fkey;

ALTER TABLE public.blocked_dates
  ADD CONSTRAINT blocked_dates_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_blocked_dates_tenant_id
  ON public.blocked_dates(tenant_id);

-- Replace permissive read policy with a tenant-scoped one mirroring the
-- pattern used by setup_surfaces above.
DROP POLICY IF EXISTS "public_read_blocked_dates" ON public.blocked_dates;

CREATE POLICY "public_read_blocked_dates" ON public.blocked_dates
  FOR SELECT
  USING (
    public.is_superadmin(auth.uid())
    OR tenant_id = public.current_tenant_id()
    OR (tenant_id)::text = COALESCE(
      ((current_setting('request.headers'::text, true))::json ->> 'x-tenant-id'::text),
      ''::text
    )
  );
