-- ─────────────────────────────────────────────────────────────────────────
-- 1099-NEC AUTOMATION — driver_tax_profiles
-- ─────────────────────────────────────────────────────────────────────────
-- Stores W9 / tax info per driver email. Lets /admin/reports/1099-nec
-- compile the year-end totals + status badges for every contractor who
-- earned $600+ in a calendar year (the IRS threshold for 1099-NEC filing).
--
-- Keyed by email (not user_id) because some drivers may be tagged only by
-- email on booking_expenses without having an app_users / auth account.
--
-- Run AFTER supabase/booking_expense_categories.sql.
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.driver_tax_profiles (
  driver_email text primary key,
  full_name text,                  -- legal name as it appears on W9
  business_name text,              -- if filed as a DBA / LLC
  tin_last4 text check (tin_last4 is null or tin_last4 ~ '^\d{4}$'),
  -- Mailing address for 1099 mailing
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  -- W9 file (Supabase storage path in the existing 'w9' bucket from
  -- supabase/w9_private_bucket.sql)
  w9_storage_path text,
  w9_received_at timestamptz,
  w9_tax_year int,                 -- year the W9 was signed (W9s don't expire
                                   -- but admin may want to track most recent)
  -- Filing status for the year (set by admin once 1099 has been filed)
  -- key = year, value = ISO timestamp when filed. JSON for flexibility.
  filed_history jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_tax_profiles_w9_received_idx
  on public.driver_tax_profiles(w9_received_at)
  where w9_received_at is not null;

-- RLS: admin only
alter table public.driver_tax_profiles enable row level security;

drop policy if exists "admin read driver_tax_profiles" on public.driver_tax_profiles;
create policy "admin read driver_tax_profiles"
  on public.driver_tax_profiles for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admin manage driver_tax_profiles" on public.driver_tax_profiles;
create policy "admin manage driver_tax_profiles"
  on public.driver_tax_profiles for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- touch updated_at on update
create or replace function public.touch_driver_tax_profiles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_driver_tax_profiles on public.driver_tax_profiles;
create trigger trg_touch_driver_tax_profiles
  before update on public.driver_tax_profiles
  for each row execute function public.touch_driver_tax_profiles_updated_at();

-- Site setting: 1099-NEC threshold (IRS = $600 in 2024-2025; may change)
insert into public.site_settings (key, value, description, category) values
  (
    '1099_nec_threshold_cents',
    '60000',
    'Minimum annual payout to a contractor that triggers 1099-NEC filing requirement. IRS default is $600 (= 60000 cents).',
    'accounting'
  )
on conflict (key) do nothing;
