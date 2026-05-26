-- ════════════════════════════════════════════════════════════════
-- ACCOUNTING MODULE — Phase 1
-- ════════════════════════════════════════════════════════════════
-- Two tables that let admin track REAL profitability:
--   1. booking_expenses — variable costs tied to specific bookings
--      (gas, driver hours/payroll, tolls, consumables, damage repairs)
--   2. overhead_costs — fixed monthly overhead (rent, insurance,
--      software subs, utilities, marketing) that gets ALLOCATED across
--      all bookings in the period.
--
-- Combined with bookings.total_amount this lets us compute:
--   Revenue (sum bookings.total_amount in period)
--   - Direct COGS (sum booking_expenses for those bookings)
--   - Allocated overhead ((overhead monthly / bookings in month) per booking)
--   = Net profit
--
-- Per-product margin = revenue per product - direct costs allocated to that product
-- Per-driver payroll = sum of payroll-category booking_expenses for that driver

-- ── 1. Per-booking variable expenses ────────────────────────────
create table if not exists public.booking_expenses (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  category text not null check (category in (
    'gas',           -- fuel for delivery/pickup trip
    'payroll',       -- driver/crew hours (use driver_hours field)
    'tolls',         -- highway tolls if any
    'consumables',   -- extra propane, cleaning supplies, etc.
    'damage_repair', -- cost to fix damaged equipment after this booking
    'permit_fee',    -- venue/city permits sometimes required
    'other'          -- catch-all
  )),
  description text,
  amount_cents int not null check (amount_cents >= 0),
  -- For payroll category: how many hours the crew worked on this booking.
  -- Useful for per-driver labor reports + future automated payroll.
  driver_hours numeric(6,2),
  driver_email text,
  -- Audit
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists booking_expenses_booking_idx
  on public.booking_expenses(booking_id, recorded_at desc);
create index if not exists booking_expenses_category_idx
  on public.booking_expenses(category, recorded_at desc);
create index if not exists booking_expenses_driver_idx
  on public.booking_expenses(driver_email, recorded_at desc)
  where driver_email is not null;
create index if not exists booking_expenses_period_idx
  on public.booking_expenses(recorded_at desc);

alter table public.booking_expenses enable row level security;

drop policy if exists "staff_or_admin read expenses" on public.booking_expenses;
create policy "staff_or_admin read expenses"
  on public.booking_expenses for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage expenses" on public.booking_expenses;
create policy "admin manage expenses"
  on public.booking_expenses for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── 2. Fixed monthly overhead ───────────────────────────────────
create table if not exists public.overhead_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- "Warehouse rent", "Liability insurance", etc.
  category text not null check (category in (
    'rent',
    'insurance',
    'software',     -- Supabase, Vercel, Stripe, GHL, Twilio, etc.
    'utilities',    -- electric, internet, phone
    'marketing',    -- ads, listings, SEO
    'vehicle',      -- truck/trailer monthly payments, registration
    'payroll',      -- salaried staff (not hourly drivers)
    'professional', -- accountant, attorney, consultants
    'other'
  )),
  monthly_cents int not null check (monthly_cents >= 0),
  -- When this cost started + ended (so historical periods compute correctly
  -- if you raise/lower rent or drop a subscription)
  effective_from date not null default current_date,
  effective_to date,                  -- null = still active
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists overhead_costs_active_idx
  on public.overhead_costs(category, effective_from)
  where effective_to is null;

create or replace function public.touch_overhead_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists overhead_set_updated_at on public.overhead_costs;
create trigger overhead_set_updated_at
  before update on public.overhead_costs
  for each row execute function public.touch_overhead_updated_at();

alter table public.overhead_costs enable row level security;

drop policy if exists "admin read overhead" on public.overhead_costs;
create policy "admin read overhead"
  on public.overhead_costs for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admin manage overhead" on public.overhead_costs;
create policy "admin manage overhead"
  on public.overhead_costs for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ── 3. Optional: driver hourly rate (for auto payroll calc) ────
insert into public.site_settings (key, value, description, category) values
  (
    'default_driver_hourly_rate_cents',
    '2000',
    'Default driver hourly rate in cents ($20.00). Used as a hint when admin records payroll expenses on a booking — admin can still enter a different amount per booking.',
    'accounting'
  )
on conflict (key) do nothing;
