-- Customer-selected add-ons in checkout (chairs, tables, generators, etc.)
-- Stored as JSON array on the booking. Each entry:
--   { product_id, slug, name, quantity, unit_price_cents, line_total_cents }

alter table public.bookings
  add column if not exists addons jsonb not null default '[]'::jsonb,
  add column if not exists addons_total_cents int not null default 0 check (addons_total_cents >= 0);

comment on column public.bookings.addons is
  'Customer-selected add-on products: array of {product_id, slug, name, quantity, unit_price_cents, line_total_cents}';
