-- Power Supply add-on: hidden from public product listings but available
-- as a required add-on when customer indicates no power source at venue.

-- 1) Add is_addon flag to products (default false → existing products unaffected)
alter table public.products
  add column if not exists is_addon boolean not null default false;

create index if not exists products_is_addon_idx on public.products(is_addon);

-- 2) Track on each booking whether power supply was added
alter table public.bookings
  add column if not exists needs_power_supply boolean not null default false,
  add column if not exists power_supply_cents int not null default 0 check (power_supply_cents >= 0);

-- 3) Seed Add-ons category (admin can see, not used in public listings)
insert into public.categories (name, slug, description, display_order, is_active)
values ('Add-ons', 'add-ons', 'Operational add-ons (not directly rentable)', 99, true)
on conflict (slug) do nothing;

-- 4) Seed Power Supply product
insert into public.products
  (name, slug, category, description, price_per_day, image_url, stock, is_active, is_addon)
values (
  'Power Supply',
  'power-supply',
  'Add-ons',
  'Portable generator + cabling delivered to your venue when no outdoor outlet is available. Required for the inflatable blower to run.',
  15000,
  '',
  10,
  true,
  true
) on conflict (slug) do nothing;
