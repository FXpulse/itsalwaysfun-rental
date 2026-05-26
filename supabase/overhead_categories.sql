-- ─────────────────────────────────────────────────────────────────────────
-- DYNAMIC OVERHEAD CATEGORIES (Accounting module — replaces fixed CHECK)
-- ─────────────────────────────────────────────────────────────────────────
-- Lets admin manage the chart-of-accounts categories themselves instead
-- of being locked to the 9 fixed enum values from supabase/accounting.sql.
--
-- Run AFTER supabase/accounting.sql.
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.overhead_categories (
  key text primary key,             -- stable identifier (e.g. "rent", "merchant_fees")
  label text not null,              -- display name (editable) e.g. "🏢 Rent / lease"
  group_name text,                  -- optional grouping for UI: "Occupancy", "Insurance"...
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists overhead_categories_active_idx
  on public.overhead_categories(is_active, sort_order)
  where is_active = true;

-- Drop the CHECK constraint on overhead_costs.category (auto-named by Postgres).
-- Do nothing if not present (e.g. accounting.sql not yet run, or already dropped).
do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.overhead_costs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%category%';
  if c is not null then
    execute 'alter table public.overhead_costs drop constraint ' || quote_ident(c);
  end if;
exception when undefined_table then
  -- overhead_costs doesn't exist yet — run supabase/accounting.sql first
  null;
end $$;

-- RLS: admin only (same pattern as overhead_costs)
alter table public.overhead_categories enable row level security;

drop policy if exists "admin read overhead_categories" on public.overhead_categories;
create policy "admin read overhead_categories"
  on public.overhead_categories for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admin manage overhead_categories" on public.overhead_categories;
create policy "admin manage overhead_categories"
  on public.overhead_categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- touch updated_at on changes
create or replace function public.touch_overhead_categories_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_overhead_categories on public.overhead_categories;
create trigger trg_touch_overhead_categories
  before update on public.overhead_categories
  for each row execute function public.touch_overhead_categories_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- SEED: standard chart-of-accounts categories for a rental business
-- ─────────────────────────────────────────────────────────────────────────
-- Existing rows in overhead_costs use keys: rent, insurance, software, utilities,
-- marketing, vehicle, payroll, professional, other — KEEP these keys intact so
-- historical data doesn't break.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.overhead_categories (key, label, group_name, sort_order) values
  -- Occupancy
  ('rent',                  '🏢 Rent / lease (primary location)',           'Occupancy', 10),
  ('storage_warehouse',     '🏬 Storage / warehouse',                       'Occupancy', 11),
  ('utilities',             '💡 Utilities (electric, water, gas)',          'Occupancy', 12),
  ('phone_internet',        '📱 Phone / mobile / internet',                 'Occupancy', 13),
  -- Insurance
  ('insurance',             '🛡 General liability insurance',               'Insurance', 20),
  ('insurance_vehicle',     '🚙 Vehicle / commercial auto insurance',       'Insurance', 21),
  ('insurance_workers_comp','👷 Workers comp insurance',                    'Insurance', 22),
  ('insurance_property',    '🏠 Property / equipment insurance',            'Insurance', 23),
  -- Vehicles & equipment
  ('vehicle',               '🚚 Vehicle payments (loan / lease)',           'Vehicles & equipment', 30),
  ('vehicle_maintenance',   '🔧 Vehicle maintenance / repairs',             'Vehicles & equipment', 31),
  ('equipment_maintenance', '⚙ Equipment maintenance / repairs',            'Vehicles & equipment', 32),
  ('equipment_lease',       '📦 Equipment lease',                           'Vehicles & equipment', 33),
  ('depreciation',          '📉 Depreciation (non-cash, for tax)',          'Vehicles & equipment', 34),
  -- Personnel
  ('payroll',               '👥 Salaried payroll',                          'Personnel', 40),
  ('payroll_taxes',         '🧾 Payroll taxes (FICA, FUTA, SUI)',           'Personnel', 41),
  ('benefits',              '🏥 Benefits / health insurance',               'Personnel', 42),
  -- Professional services
  ('professional',          '👔 Accountant / bookkeeper',                   'Professional', 50),
  ('professional_legal',    '⚖ Attorney / legal',                           'Professional', 51),
  ('professional_consulting','💼 Consultants',                              'Professional', 52),
  -- Financial
  ('merchant_fees',         '💳 Bank / merchant fees (Stripe %, processing)','Financial', 60),
  ('loan_debt',             '🏦 Loan / debt service (principal + interest)','Financial', 61),
  ('interest',              '📈 Interest expense',                          'Financial', 62),
  ('bank_fees',             '🪙 Bank fees (account, wire)',                 'Financial', 63),
  -- Marketing & sales
  ('marketing',             '📣 Advertising (Google, Meta)',                'Marketing', 70),
  ('marketing_listings',    '📋 Listings (GigSalad, The Bash, Yelp)',       'Marketing', 71),
  ('marketing_print',       '🖨 Print / signage / vehicle wrap',            'Marketing', 72),
  ('marketing_trade_shows', '🎪 Trade shows / events',                      'Marketing', 73),
  -- Software & subscriptions
  ('software',              '💻 Software / SaaS subscriptions',             'Software', 80),
  ('memberships',           '🤝 Memberships / dues (Chamber, IAAPA, BBB)',  'Software', 81),
  ('training',              '🎓 Training / education',                      'Software', 82),
  -- Operations
  ('permits_licenses',      '📋 Permits / licenses (annual)',               'Operations', 90),
  ('office_supplies',       '📎 Office supplies',                           'Operations', 91),
  ('cleaning_supplies',     '🧹 Cleaning / janitorial supplies',            'Operations', 92),
  ('uniforms',              '👕 Uniforms / apparel',                        'Operations', 93),
  ('travel',                '✈ Travel / mileage',                           'Operations', 94),
  ('meals',                 '🍽 Meals & entertainment (50% deductible)',    'Operations', 95),
  -- Taxes (recurring)
  ('tax_property',          '🏛 Property tax (mensualizado)',               'Taxes', 100),
  ('tax_franchise',         '📊 Franchise tax',                             'Taxes', 101),
  ('tax_business_license',  '🪪 Business license tax',                      'Taxes', 102),
  -- Catch-all
  ('other',                 '🗂 Other',                                     'Other', 999)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- Done. Verify with:
--   select group_name, key, label from overhead_categories
--     where is_active order by sort_order;
-- ─────────────────────────────────────────────────────────────────────────
