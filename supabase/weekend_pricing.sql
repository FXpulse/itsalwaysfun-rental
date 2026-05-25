-- Weekend (Sat/Sun) pricing — optional alternate rate per product.
-- If null, weekday price_per_day is used for all days.
alter table public.products
  add column if not exists weekend_price_per_day int check (weekend_price_per_day is null or weekend_price_per_day >= 0);

comment on column public.products.weekend_price_per_day is
  'Optional alternate price for Saturday/Sunday days (cents). If NULL, price_per_day is used.';
