-- ─────────────────────────────────────────────────────────────────────────
-- MULTI-TENANT FOUNDATION — Chunk 1A
-- ─────────────────────────────────────────────────────────────────────────
-- Phase 1 of converting itsalwaysfun-rental into RentalFlow SaaS.
-- This migration is SAFE — does not change any existing behavior.
--
-- WHAT IT DOES:
--   1. Creates `tenants` table (the SaaS-level entities)
--   2. Inserts "It's Always Fun, LLC" as the first tenant (UUID
--      11111111-1111-1111-1111-111111111111 — hardcoded so backfills
--      are deterministic)
--   3. Adds `tenant_id uuid NOT NULL DEFAULT '1111...'` to every
--      multi-tenant-relevant table (backfills existing rows + new rows
--      auto-get the IAF tenant until middleware overrides)
--   4. Adds FK indexes for performance
--   5. Marks the current admin user as `is_superadmin` (can manage all
--      tenants, not just their own)
--
-- WHAT IT DOES NOT DO (yet):
--   - Touch RLS policies (still scoped to roles, not tenants — done in 1B)
--   - Change middleware / tenant resolution (done in 1C)
--   - Change Stripe payment flow (done in 1E)
--
-- After this migration:
--   - All existing code keeps working (tenant_id has default)
--   - Reports/queries return same data because everything is tenant_id=IAF
--   - Foundation in place for future chunks
--
-- IDEMPOTENT — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════
-- 1. TENANTS TABLE
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  -- Subdomain slug (e.g., "bouncedreams" → bouncedreams.getrentalflow.com)
  -- Lowercase letters, numbers, hyphens. Used in URL.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' and length(slug) >= 2 and length(slug) <= 60),
  -- Legal business name (displayed in admin, emails, invoices)
  business_name text not null,
  -- Tenant owner contact (primary admin)
  owner_email text not null,
  owner_phone text,
  -- Pricing tier
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'enterprise', 'founder')),
  -- Stripe Connect account ID (for cash flowing to tenant's bank)
  stripe_account_id text,
  stripe_account_status text,         -- 'pending', 'active', 'disabled'
  -- Custom domain (optional Pro/Enterprise feature). E.g. itsalwaysfun.net.
  -- When set, served at this domain instead of slug.getrentalflow.com.
  custom_domain text unique,
  -- Brand customization (logo URL, primary/secondary colors, font, etc.)
  branding jsonb not null default '{}'::jsonb,
  -- Lifecycle
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  suspended_at timestamptz,            -- non-null = paused, can't log in
  suspended_reason text
);

create index if not exists tenants_slug_idx on public.tenants(slug);
create index if not exists tenants_custom_domain_idx on public.tenants(custom_domain) where custom_domain is not null;
create index if not exists tenants_active_idx on public.tenants(suspended_at) where suspended_at is null;

-- Touch updated_at
create or replace function public.touch_tenants_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_tenants on public.tenants;
create trigger trg_touch_tenants
  before update on public.tenants
  for each row execute function public.touch_tenants_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 2. SEED THE FIRST TENANT — "It's Always Fun, LLC"
-- ════════════════════════════════════════════════════════════════════════
-- Hardcoded UUID so the rest of the migration can reference it as DEFAULT.
-- "founder" plan = unlimited, free forever (since she built the platform).

insert into public.tenants (
  id, slug, business_name, owner_email, plan, custom_domain, branding, trial_ends_at
) values (
  '11111111-1111-1111-1111-111111111111',
  'itsalwaysfun',
  'It''s Always Fun, LLC',
  'admin@itsalwaysfun.com',
  'founder',
  'itsalwaysfun.net',
  '{"primary_color": "#1a1a6e", "accent_color": "#FFD700", "font_family": "Quicksand"}'::jsonb,
  null  -- founder, no trial expiry
)
on conflict (id) do update set
  -- Keep most fields from existing if re-run, but ensure key fields are set
  business_name = excluded.business_name,
  custom_domain = excluded.custom_domain,
  plan = excluded.plan;

-- ════════════════════════════════════════════════════════════════════════
-- 3. SUPERADMIN FLAG ON user_roles
-- ════════════════════════════════════════════════════════════════════════
-- Superadmin = the SaaS owner (Ludmila). Can see + manage all tenants,
-- impersonate, suspend, view billing across the platform.

alter table public.user_roles
  add column if not exists is_superadmin boolean not null default false;

-- Promote the current admin user(s) to superadmin (you).
-- Anyone with role='admin' on the IAF tenant becomes superadmin since
-- you're the only admin pre-SaaS-launch.
update public.user_roles
set is_superadmin = true
where role = 'admin' and is_active = true;

-- ════════════════════════════════════════════════════════════════════════
-- 4. ADD tenant_id TO EVERY MULTI-TENANT TABLE
-- ════════════════════════════════════════════════════════════════════════
-- All defaults point to the IAF tenant so existing rows backfill +
-- new code (without tenant context) still works during transition.

-- Helper: adds tenant_id (nullable then NOT NULL with default) + FK + index.
-- Wrapped in DO so we can loop, but written explicitly for clarity.

do $$
declare
  t text;
  tables_list text[] := array[
    -- Customer + transaction data
    'bookings',
    'customer_profiles',
    'gift_cards',
    'quotes',
    'payout_requests',
    'contact_messages',
    'reviews',
    -- Children of bookings — explicit tenant_id for fast filtering
    'booking_expenses',
    'booking_damages',
    'booking_proofs',
    'booking_waivers',
    'booking_extensions',
    'coi_requests',
    'dispatch_routes',
    'dispatch_stops',
    -- Configuration & catalog
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
    -- Accounting + admin
    'overhead_costs',
    'overhead_categories',
    'booking_expense_categories',
    'driver_tax_profiles',
    'audit_log',
    -- Site config + content
    'site_settings',
    'email_templates',
    'home_banners',
    'faqs',
    -- Auth / users
    'user_roles'
    -- NOTE: tables we DON'T add tenant_id to:
    --   auth.users (Supabase-managed)
    --   storage.objects (segmented via bucket policies)
  ];
begin
  foreach t in array tables_list loop
    if to_regclass('public.' || t) is null then
      raise notice '⊘ skip %: table does not exist', t;
      continue;
    end if;

    -- Add column with default (backfills existing rows in one shot)
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid not null default %L references public.tenants(id) on delete restrict',
      t, '11111111-1111-1111-1111-111111111111'
    );

    -- Index for fast tenant-scoped queries
    execute format(
      'create index if not exists %I on public.%I(tenant_id)',
      t || '_tenant_id_idx', t
    );

    raise notice '✓ tenant_id added to %', t;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. RLS ON tenants TABLE
-- ════════════════════════════════════════════════════════════════════════
-- Tenants can read/update their own row. Superadmin can manage all.

alter table public.tenants enable row level security;

-- Helper: is the current auth.uid() a superadmin?
create or replace function public.is_superadmin(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and is_active = true and is_superadmin = true
  );
$$;

drop policy if exists "tenant owner reads own" on public.tenants;
create policy "tenant owner reads own"
  on public.tenants for select
  using (
    public.is_superadmin(auth.uid())
    or owner_email = auth.email()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and is_active = true
    )
  );

drop policy if exists "tenant owner updates own" on public.tenants;
create policy "tenant owner updates own"
  on public.tenants for update
  using (
    public.is_superadmin(auth.uid()) or owner_email = auth.email()
  )
  with check (
    public.is_superadmin(auth.uid()) or owner_email = auth.email()
  );

drop policy if exists "superadmin manages tenants" on public.tenants;
create policy "superadmin manages tenants"
  on public.tenants for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ════════════════════════════════════════════════════════════════════════
-- 6. VERIFY
-- ════════════════════════════════════════════════════════════════════════
-- Quick sanity queries. After running this migration, the results should be:
--   - tenants: 1 row (It's Always Fun)
--   - bookings.tenant_id: all rows have the IAF UUID
--   - user_roles: at least 1 row with is_superadmin=true

-- (Uncomment to see results in SQL editor)
-- select count(*) as tenants_count from public.tenants;
-- select count(*) as superadmins from public.user_roles where is_superadmin = true;
-- select distinct tenant_id from public.bookings;

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
-- Reload PostgREST so the API picks up the new column + table immediately:
notify pgrst, 'reload schema';
