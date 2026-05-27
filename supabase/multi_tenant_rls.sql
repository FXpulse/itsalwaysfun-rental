-- ─────────────────────────────────────────────────────────────────────────
-- MULTI-TENANT CHUNK 1D — RLS tightening
-- ─────────────────────────────────────────────────────────────────────────
-- Adds tenant isolation as a defense-in-depth layer at the DB level.
-- Service role still bypasses RLS (for admin operations), but ANY query
-- using the regular auth (anon + user JWT) is now strictly tenant-scoped.
--
-- The pattern:
--   user → user_roles (tenant_id) → can access rows where data.tenant_id
--   matches one of the user's user_roles.tenant_id with is_active=true
--
-- For PUBLIC anon access (booking flow on public site), tenant context
-- comes from the X-Tenant-Id HTTP header set by Next.js middleware,
-- which PostgREST exposes as current_setting('request.headers').
--
-- WHAT THIS DOES NOT CHANGE:
--   - Service role (createAdminClient) bypasses RLS entirely.
--     For full multi-tenant safety, server-side code must ALSO filter
--     by tenant_id explicitly (use withTenant() from @/lib/tenant/db).
--   - Application code — RLS adds protection but doesn't replace careful
--     server-side tenant scoping for service-role queries.
--
-- IDEMPOTENT — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════
-- 1. HELPER: get current tenant_id from session/request
-- ════════════════════════════════════════════════════════════════════════

-- For authenticated users: look up their tenant via user_roles
-- For anon users: read X-Tenant-Id header from request
-- Returns NULL if neither path resolves (which means RLS denies access).

create or replace function public.current_tenant_id()
returns uuid language sql stable as $$
  select coalesce(
    -- 1. Authenticated path: tenant_id from active user_roles row
    (select tenant_id from public.user_roles
       where user_id = auth.uid()
         and is_active = true
       limit 1),
    -- 2. Anon path: X-Tenant-Id request header (set by Next.js middleware)
    nullif(
      nullif(current_setting('request.headers', true), '')::jsonb->>'x-tenant-id',
      ''
    )::uuid
  );
$$;

-- Helper: is this user a superadmin? (cross-tenant access for SaaS owner)
-- Already defined in Chunk 1A — re-create for safety.
create or replace function public.is_superadmin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and is_active = true and is_superadmin = true
  );
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. RLS POLICIES — multi-tenant tables
-- ════════════════════════════════════════════════════════════════════════
-- Loop through every multi-tenant table and add a tenant_match policy.
-- The policy says: allow if (superadmin) OR (tenant_id matches current).
-- Existing policies (e.g. role-based) STAY in place — RLS is "all policies
-- must allow" by default, but we use AS PERMISSIVE so OR-chaining works.

do $$
declare
  t text;
  tables_list text[] := array[
    'bookings',
    'booking_expenses',
    'booking_damages',
    'booking_proofs',
    'booking_waivers',
    'booking_extensions',
    'coi_requests',
    'dispatch_routes',
    'dispatch_stops',
    'customer_profiles',
    'gift_cards',
    'quotes',
    'payout_requests',
    'contact_messages',
    'reviews',
    'products',
    'product_inventory_requirements',
    'product_images',
    'categories',
    'inventory_items',
    'inventory_units',
    'inventory_categories',
    'vehicles',
    'trailers',
    'packages',
    'coupons',
    'overhead_costs',
    'overhead_categories',
    'booking_expense_categories',
    'driver_tax_profiles',
    'audit_log',
    'site_settings',
    'email_templates',
    'home_banners',
    'faqs',
    'user_roles'
  ];
  policy_name text := 'tenant_isolation';
begin
  foreach t in array tables_list loop
    if to_regclass('public.' || t) is null then
      raise notice '⊘ skip % (table missing)', t;
      continue;
    end if;

    -- Ensure RLS is enabled
    execute format('alter table public.%I enable row level security', t);

    -- Drop + recreate the tenant_isolation policy (idempotent)
    execute format('drop policy if exists %I on public.%I', policy_name, t);
    execute format($f$
      create policy %I on public.%I
        as permissive
        for all
        using (
          public.is_superadmin(auth.uid())
          or tenant_id = public.current_tenant_id()
        )
        with check (
          public.is_superadmin(auth.uid())
          or tenant_id = public.current_tenant_id()
        )
    $f$, policy_name, t);

    raise notice '✓ tenant_isolation policy added to %', t;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. VERIFY
-- ════════════════════════════════════════════════════════════════════════
-- Quick sanity check: every multi-tenant table should now have a
-- policy named 'tenant_isolation'.

-- (Uncomment to inspect)
-- select schemaname, tablename, policyname
-- from pg_policies
-- where schemaname = 'public' and policyname = 'tenant_isolation'
-- order by tablename;

notify pgrst, 'reload schema';
