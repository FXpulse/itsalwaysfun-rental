-- ════════════════════════════════════════════════════════════════════
-- COMBINED MIGRATIONS — RUN IN SUPABASE SQL EDITOR
-- ════════════════════════════════════════════════════════════════════
-- This file concatenates EVERY migration in the supabase/ folder in the
-- correct dependency order. Re-running is safe (everything uses IF NOT
-- EXISTS / on conflict do nothing / drop policy if exists).
--
-- If you've already run individual files, this still works — it just
-- re-asserts the schema and policies. No data loss.
--
-- Last updated: 2026-05-28
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1. user_roles + role helpers (FOUNDATION — run first if from scratch)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check check (role in ('admin','staff','driver'));

create index if not exists user_roles_role_idx on public.user_roles(role);
create index if not exists user_roles_is_active_idx on public.user_roles(is_active);

create or replace function public.touch_user_roles_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists user_roles_set_updated_at on public.user_roles;
create trigger user_roles_set_updated_at
  before update on public.user_roles for each row execute function public.touch_user_roles_updated_at();

-- Seed known admin emails
insert into public.user_roles (user_id, role, is_active)
select u.id, 'admin', true from auth.users u
where u.email in ('admin@itsalwaysfun.com', 'ludmilayhenry@gmail.com')
on conflict (user_id) do update set role = 'admin', is_active = true;

create or replace function public.is_admin(uid uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from public.user_roles where user_id = uid and role = 'admin' and is_active = true);
$$;
create or replace function public.is_staff_or_admin(uid uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','staff') and is_active = true);
$$;
create or replace function public.is_driver_or_above(uid uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('admin','staff','driver') and is_active = true);
$$;

alter table public.user_roles enable row level security;
drop policy if exists "admins can manage roles" on public.user_roles;
create policy "admins can manage roles" on public.user_roles for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "users can read own role" on public.user_roles;
create policy "users can read own role" on public.user_roles for select using (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════
-- 2. Existing tables extensions (bookings + products)
-- ════════════════════════════════════════════════════════════════════

-- bookings extensions
alter table public.bookings add column if not exists payment_method text;
alter table public.bookings add column if not exists event_end_date date;
alter table public.bookings add column if not exists coupon_code text;
alter table public.bookings add column if not exists discount_amount int not null default 0;
alter table public.bookings add column if not exists surface_type text
  check (surface_type in ('dirt','grass','concrete','paver','asphalt','other'));
alter table public.bookings add column if not exists needs_power_supply boolean not null default false;
alter table public.bookings add column if not exists power_supply_cents int not null default 0;
alter table public.bookings add column if not exists customer_confirmed_at timestamptz;
alter table public.bookings add column if not exists delivery_checked_at timestamptz;
alter table public.bookings add column if not exists delivery_checked_by text;
alter table public.bookings add column if not exists addons jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists addons_total_cents int not null default 0;
alter table public.bookings add column if not exists damage_protection_purchased boolean not null default false;
alter table public.bookings add column if not exists damage_protection_cents int not null default 0;

-- products extensions
alter table public.products add column if not exists is_addon boolean not null default false;
alter table public.products add column if not exists cost_cents int not null default 0;
alter table public.products add column if not exists weekend_price_per_day int;
create index if not exists products_is_addon_idx on public.products(is_addon);

-- ════════════════════════════════════════════════════════════════════
-- 3. Coupons
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value int not null,
  max_uses int,
  current_uses int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 4. FAQs
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 5. Inventory items + maintenance log
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',
  description text,
  quantity_owned int not null default 1 check (quantity_owned >= 0),
  quantity_in_use int not null default 0 check (quantity_in_use >= 0),
  location text,
  condition text not null default 'good' check (condition in ('good','needs_repair','broken','retired')),
  purchase_date date,
  purchase_cost_cents int default 0 check (purchase_cost_cents >= 0),
  last_maintenance_date date,
  maintenance_notes text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_maintenance (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  type text not null check (type in ('cleaning','repair','inspection','replacement','other')),
  description text not null,
  cost_cents int not null default 0,
  performed_by text,
  performed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_inventory_requirements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  surface_types text[],
  only_when_needs_power boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 6. Quotes
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null,
  token text unique not null,
  customer_first_name text not null,
  customer_last_name text not null,
  customer_company text,
  customer_email text not null,
  customer_phone text not null,
  customer_address text,
  event_date date not null,
  event_end_date date,
  start_time time,
  end_time time,
  line_items jsonb not null default '[]'::jsonb,
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  discount_note text,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  customer_message text,
  internal_notes text,
  status text not null default 'draft' check (status in ('draft','sent','viewed','approved','declined','expired','converted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  expires_at timestamptz default (now() + interval '14 days'),
  converted_booking_id uuid references public.bookings(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null
);

create or replace function public.next_quote_number() returns text language plpgsql as $$
declare y text; c int;
begin
  y := to_char(now(), 'YYYY');
  select coalesce(count(*), 0) + 1 into c from public.quotes where quote_number like 'Q-' || y || '-%';
  return 'Q-' || y || '-' || lpad(c::text, 4, '0');
end;
$$;
create or replace function public.new_quote_token() returns text language sql as $$
  select encode(gen_random_bytes(16), 'hex');
$$;

-- ════════════════════════════════════════════════════════════════════
-- 7. Home banners
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.home_banners (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  alt_text text,
  link_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- 8. Loyalty + Referrals
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text unique not null,
  referred_by_user_id uuid references auth.users(id) on delete set null,
  loyalty_points int not null default 0 check (loyalty_points >= 0),
  commission_pending_cents int not null default 0 check (commission_pending_cents >= 0),
  commission_paid_cents int not null default 0 check (commission_paid_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('booking_points','referral_commission','points_redeemed','commission_payout','admin_adjustment')),
  points int not null default 0,
  commission_cents int not null default 0,
  booking_id uuid references public.bookings(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create or replace function public.generate_referral_code() returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; exists_already boolean;
begin
  loop
    code := '';
    for i in 1..8 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    select exists(select 1 from public.customer_profiles where referral_code = code) into exists_already;
    if not exists_already then return code; end if;
  end loop;
end;
$$;

create or replace function public.ensure_customer_profile(uid uuid) returns text language plpgsql as $$
declare existing_code text; new_code text;
begin
  select referral_code into existing_code from public.customer_profiles where user_id = uid;
  if existing_code is not null then return existing_code; end if;
  new_code := public.generate_referral_code();
  insert into public.customer_profiles (user_id, referral_code) values (uid, new_code) on conflict (user_id) do nothing;
  select referral_code into existing_code from public.customer_profiles where user_id = uid;
  return existing_code;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 9. Email templates + booking email scheduling
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  description text,
  subject text not null,
  email_title text not null,
  body_html text not null,
  body_text text not null,
  available_vars text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_emails_sent (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  email_type text not null,
  sent_at timestamptz not null default now(),
  resend_id text,
  success boolean not null default true,
  error_message text,
  unique (booking_id, email_type)
);

alter table public.booking_emails_sent drop constraint if exists booking_emails_sent_email_type_check;
alter table public.booking_emails_sent
  add constraint booking_emails_sent_email_type_check
  check (email_type in ('booking_confirmation','booking_reminder_3d','booking_review_request','booking_anniversary_1y','booking_refunded','booking_cancelled'));

-- ════════════════════════════════════════════════════════════════════
-- 10. Booking proofs + damages
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.booking_proofs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  phase text not null check (phase in ('delivery','pickup')),
  captured_at timestamptz not null default now(),
  captured_by text,
  customer_signature_url text,
  customer_signature_name text,
  photos jsonb not null default '[]'::jsonb,
  condition_notes text,
  unique (booking_id, phase)
);

create table if not exists public.booking_damages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  description text not null,
  severity text not null default 'minor' check (severity in ('minor','moderate','major')),
  cost_cents int not null default 0,
  customer_responsible boolean not null default false,
  charged_to_customer boolean not null default false,
  covered_by_protection boolean not null default false,
  photo_url text,
  recorded_at timestamptz not null default now(),
  recorded_by text,
  resolved boolean not null default false,
  notes text
);

-- ════════════════════════════════════════════════════════════════════
-- 11. Fleet + dispatch (delivery + pickup routes)
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_type text not null default 'truck' check (vehicle_type in ('truck','van','pickup','other')),
  requires_trailer boolean not null default true,
  capacity_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispatch_routes (
  id uuid primary key default gen_random_uuid(),
  route_date date not null,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  trailer_id uuid references public.trailers(id) on delete set null,
  driver_name text,
  notes text,
  status text not null default 'planned' check (status in ('planned','loaded','out','completed','cancelled')),
  route_type text not null default 'delivery' check (route_type in ('delivery','pickup')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dispatch_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.dispatch_routes(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stop_order int not null default 0,
  notes text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

-- Drop the strict unique on booking_id (delivery + pickup are separate routes)
alter table public.dispatch_stops drop constraint if exists dispatch_stops_booking_id_key;

-- ════════════════════════════════════════════════════════════════════
-- 12. Categories seed (Add-ons)
-- ════════════════════════════════════════════════════════════════════
insert into public.categories (name, slug, description, display_order, is_active)
values ('Add-ons', 'add-ons', 'Operational add-ons', 99, true)
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- 13. Seed Power Supply product
-- ════════════════════════════════════════════════════════════════════
insert into public.products (name, slug, category, description, price_per_day, image_url, stock, is_active, is_addon)
values ('Power Supply', 'power-supply', 'Add-ons', 'Portable generator + cabling delivered when no outdoor outlet is available.', 15000, '', 10, true, true)
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- 14. Site settings (defaults — won't overwrite existing values)
-- ════════════════════════════════════════════════════════════════════
insert into public.site_settings (key, value, description, category) values
  -- Loyalty
  ('loyalty_points_per_dollar', '1', 'Points per $1', 'loyalty'),
  ('loyalty_points_redemption_rate', '100', '100 pts = $1', 'loyalty'),
  ('referral_commission_pct', '10', '% commission on referral first booking', 'loyalty'),
  ('loyalty_min_redeem_points', '500', 'Min points to redeem', 'loyalty'),
  ('commission_payout_threshold_cents', '5000', 'Payout threshold ($50)', 'loyalty'),
  -- General
  ('min_booking_lead_hours', '48', 'Min hours notice for public bookings', 'general'),
  ('damage_protection_enabled', 'true', 'Show damage protection at checkout', 'general'),
  ('damage_protection_price_cents', '2500', 'Damage protection fee ($25)', 'general'),
  ('damage_protection_coverage_cents', '50000', 'Damage protection coverage ($500)', 'general'),
  ('google_review_url', '', 'Google review link for review_request email', 'business'),
  -- Appearance
  ('hero_bg_color', '', 'Hero background', 'appearance'),
  ('hero_text_color', '', 'Hero text', 'appearance'),
  ('hero_font_family', '', 'Hero font', 'appearance'),
  ('categories_bg_color', '', 'Categories bg', 'appearance'),
  ('categories_text_color', '', 'Categories text', 'appearance'),
  ('categories_font_family', '', 'Categories font', 'appearance'),
  ('featured_bg_color', '', 'Featured bg', 'appearance'),
  ('featured_text_color', '', 'Featured text', 'appearance'),
  ('featured_font_family', '', 'Featured font', 'appearance'),
  ('trust_bg_color', '', 'Trust bg', 'appearance'),
  ('trust_text_color', '', 'Trust text', 'appearance'),
  ('trust_font_family', '', 'Trust font', 'appearance'),
  ('footer_bg_color', '', 'Footer bg', 'appearance'),
  ('footer_text_color', '', 'Footer text', 'appearance'),
  ('footer_font_family', '', 'Footer font', 'appearance')
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- 15. RLS enable + policies (run at end so all tables exist)
-- ════════════════════════════════════════════════════════════════════
alter table public.coupons enable row level security;
alter table public.faqs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_maintenance enable row level security;
alter table public.product_inventory_requirements enable row level security;
alter table public.quotes enable row level security;
alter table public.home_banners enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.email_templates enable row level security;
alter table public.booking_emails_sent enable row level security;
alter table public.booking_proofs enable row level security;
alter table public.booking_damages enable row level security;
alter table public.vehicles enable row level security;
alter table public.trailers enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_stops enable row level security;

-- Inventory
drop policy if exists "staff_or_admin read inventory" on public.inventory_items;
create policy "staff_or_admin read inventory" on public.inventory_items for select using (public.is_driver_or_above(auth.uid()));
drop policy if exists "admin write inventory" on public.inventory_items;
create policy "admin write inventory" on public.inventory_items for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "staff write inventory ops" on public.inventory_items;
create policy "staff write inventory ops" on public.inventory_items for update using (public.is_staff_or_admin(auth.uid())) with check (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin manage maintenance" on public.inventory_maintenance;
create policy "staff_or_admin manage maintenance" on public.inventory_maintenance for all using (public.is_staff_or_admin(auth.uid())) with check (public.is_staff_or_admin(auth.uid()));

drop policy if exists "driver_or_above read req" on public.product_inventory_requirements;
create policy "driver_or_above read req" on public.product_inventory_requirements for select using (public.is_driver_or_above(auth.uid()));
drop policy if exists "admin manage req" on public.product_inventory_requirements;
create policy "admin manage req" on public.product_inventory_requirements for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Quotes
drop policy if exists "admin manage quotes" on public.quotes;
create policy "admin manage quotes" on public.quotes for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "staff read quotes" on public.quotes;
create policy "staff read quotes" on public.quotes for select using (public.is_staff_or_admin(auth.uid()));

-- Home banners
drop policy if exists "public read banners" on public.home_banners;
create policy "public read banners" on public.home_banners for select using (is_active = true);
drop policy if exists "admin manage banners" on public.home_banners;
create policy "admin manage banners" on public.home_banners for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Loyalty
drop policy if exists "users read own profile" on public.customer_profiles;
create policy "users read own profile" on public.customer_profiles for select using (auth.uid() = user_id);
drop policy if exists "admin manage profiles" on public.customer_profiles;
create policy "admin manage profiles" on public.customer_profiles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "users read own tx" on public.loyalty_transactions;
create policy "users read own tx" on public.loyalty_transactions for select using (auth.uid() = user_id);
drop policy if exists "admin manage tx" on public.loyalty_transactions;
create policy "admin manage tx" on public.loyalty_transactions for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Email templates
drop policy if exists "admin manage templates" on public.email_templates;
create policy "admin manage templates" on public.email_templates for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Booking proofs + damages
drop policy if exists "driver_or_above manage proofs" on public.booking_proofs;
create policy "driver_or_above manage proofs" on public.booking_proofs for all using (public.is_driver_or_above(auth.uid())) with check (public.is_driver_or_above(auth.uid()));
drop policy if exists "driver_or_above manage damages" on public.booking_damages;
create policy "driver_or_above manage damages" on public.booking_damages for all using (public.is_driver_or_above(auth.uid())) with check (public.is_driver_or_above(auth.uid()));

-- Bookings extended access for drivers
drop policy if exists "driver_or_above read bookings" on public.bookings;
create policy "driver_or_above read bookings" on public.bookings for select using (public.is_driver_or_above(auth.uid()));

-- Fleet
drop policy if exists "staff_or_admin read vehicles" on public.vehicles;
create policy "staff_or_admin read vehicles" on public.vehicles for select using (public.is_staff_or_admin(auth.uid()));
drop policy if exists "admin manage vehicles" on public.vehicles;
create policy "admin manage vehicles" on public.vehicles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists "staff_or_admin read trailers" on public.trailers;
create policy "staff_or_admin read trailers" on public.trailers for select using (public.is_staff_or_admin(auth.uid()));
drop policy if exists "admin manage trailers" on public.trailers;
create policy "admin manage trailers" on public.trailers for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Dispatch (drivers can read/update stops + read routes)
drop policy if exists "driver_or_above read routes" on public.dispatch_routes;
create policy "driver_or_above read routes" on public.dispatch_routes for select using (public.is_driver_or_above(auth.uid()));
drop policy if exists "staff_or_admin manage routes" on public.dispatch_routes;
create policy "staff_or_admin manage routes" on public.dispatch_routes for all using (public.is_staff_or_admin(auth.uid())) with check (public.is_staff_or_admin(auth.uid()));
drop policy if exists "driver_or_above read stops" on public.dispatch_stops;
create policy "driver_or_above read stops" on public.dispatch_stops for select using (public.is_driver_or_above(auth.uid()));
drop policy if exists "driver_or_above update stops" on public.dispatch_stops;
create policy "driver_or_above update stops" on public.dispatch_stops for update using (public.is_driver_or_above(auth.uid())) with check (public.is_driver_or_above(auth.uid()));
drop policy if exists "staff_or_admin manage stops" on public.dispatch_stops;
create policy "staff_or_admin manage stops" on public.dispatch_stops for all using (public.is_staff_or_admin(auth.uid())) with check (public.is_staff_or_admin(auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- DONE. After running, verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' ORDER BY table_name;
-- ════════════════════════════════════════════════════════════════════
