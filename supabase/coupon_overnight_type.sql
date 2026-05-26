-- Add a new coupon discount_type: 'overnight_free'.
-- This type waives ONLY the 2nd day surcharge (30% of day-2 base price) when
-- the rental is exactly 2 days (overnight). For 1-day or 3+ day rentals, the
-- coupon is rejected with a clear message.
--
-- discount_value is ignored for this type (calculated from the booking dynamically).

alter table public.coupons
  drop constraint if exists coupons_discount_type_check;

alter table public.coupons
  add constraint coupons_discount_type_check
  check (discount_type in ('percent', 'fixed', 'overnight_free'));

-- Optional: seed an example "OVERNIGHT" coupon (inactive by default — activate when ready)
insert into public.coupons (code, description, discount_type, discount_value, is_active)
values (
  'OVERNIGHT',
  'Free overnight upgrade — waives the 30% second-day surcharge on 2-day rentals only.',
  'overnight_free',
  0,  -- ignored for this type
  false
)
on conflict (code) do nothing;
