-- Damage protection opt-in at checkout. Customer pays a flat fee per booking
-- (one-time, not per day) for accidental damage coverage up to a threshold.
-- If they opted in AND damage is recorded, admin can mark it as covered
-- (not charged to customer) without manual hassle.

alter table public.bookings
  add column if not exists damage_protection_purchased boolean not null default false,
  add column if not exists damage_protection_cents int not null default 0 check (damage_protection_cents >= 0);

-- Add 'covered_by_protection' flag to damages so admin can apply coverage
alter table public.booking_damages
  add column if not exists covered_by_protection boolean not null default false;

-- Settings: price + coverage amount + on/off toggle
insert into public.site_settings (key, value, description, category) values
  ('damage_protection_enabled', 'true', 'Show damage protection opt-in at checkout. Set to false to hide.', 'general'),
  ('damage_protection_price_cents', '2500', 'Flat fee charged for damage protection ($25 = 2500). One-time per booking.', 'general'),
  ('damage_protection_coverage_cents', '50000', 'Max damage covered when customer opts in ($500 = 50000)', 'general')
on conflict (key) do nothing;
