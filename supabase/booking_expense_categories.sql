-- ─────────────────────────────────────────────────────────────────────────
-- DYNAMIC BOOKING EXPENSE CATEGORIES (Accounting module)
-- ─────────────────────────────────────────────────────────────────────────
-- Replaces the fixed CHECK on booking_expenses.category with a DB-backed
-- table so admin can add/edit/deactivate per-booking expense categories
-- without code changes.
--
-- Includes a `supports_payroll_hours` flag — categories with this flag enable
-- the "driver hours + email" UI in the booking expense form (auto-computes
-- amount from hours × default_driver_hourly_rate_cents). Useful for any
-- labor-style category: payroll, setup_labor, teardown_labor, etc.
--
-- Run AFTER supabase/accounting.sql.
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.booking_expense_categories (
  key text primary key,
  label text not null,
  sort_order int not null default 100,
  is_active boolean not null default true,
  -- when true, the booking-expense form shows the "driver hours + email"
  -- inputs and auto-suggests the amount from default_driver_hourly_rate_cents
  supports_payroll_hours boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_expense_categories_active_idx
  on public.booking_expense_categories(is_active, sort_order)
  where is_active = true;

-- Drop the auto-named CHECK on booking_expenses.category if present
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.booking_expenses'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%category%';
  if c is not null then
    execute 'alter table public.booking_expenses drop constraint ' || quote_ident(c);
  end if;
exception when undefined_table then
  null;
end $$;

-- RLS: admin manages; staff can read (mirrors overhead_categories)
alter table public.booking_expense_categories enable row level security;

drop policy if exists "staff read booking_expense_categories"
  on public.booking_expense_categories;
create policy "staff read booking_expense_categories"
  on public.booking_expense_categories for select
  using (
    public.is_admin(auth.uid())
    or exists (select 1 from public.app_users u
               where u.id = auth.uid() and u.role in ('admin','staff'))
  );

drop policy if exists "admin manage booking_expense_categories"
  on public.booking_expense_categories;
create policy "admin manage booking_expense_categories"
  on public.booking_expense_categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- updated_at trigger
create or replace function public.touch_booking_expense_categories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_booking_expense_categories
  on public.booking_expense_categories;
create trigger trg_touch_booking_expense_categories
  before update on public.booking_expense_categories
  for each row execute function public.touch_booking_expense_categories_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- SEED: the 7 existing categories (keep keys intact for historical rows)
-- plus a few common rental ones
-- ─────────────────────────────────────────────────────────────────────────
insert into public.booking_expense_categories
  (key, label, sort_order, supports_payroll_hours) values
  ('gas',           '⛽ Gas / fuel',                       10, false),
  ('payroll',       '👥 Payroll (driver hours)',           20, true),
  ('setup_labor',   '🔨 Setup labor (hours)',              21, true),
  ('teardown_labor','🧹 Teardown labor (hours)',           22, true),
  ('tolls',         '🛣 Tolls',                            30, false),
  ('consumables',   '📦 Consumables (propane, ice, etc.)', 40, false),
  ('cleaning_fee',  '🧼 Cleaning fee',                     50, false),
  ('parking',       '🅿️ Parking',                          60, false),
  ('lodging',       '🏨 Lodging (overnight trips)',        70, false),
  ('damage_repair', '🔧 Damage repair',                    80, false),
  ('permit_fee',    '📋 Permit / venue fee',               90, false),
  ('other',         '🗂 Other',                            999, false)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Done. Verify with:
--   select key, label, supports_payroll_hours from booking_expense_categories
--     where is_active order by sort_order;
-- ─────────────────────────────────────────────────────────────────────────
