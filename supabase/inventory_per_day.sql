-- Per-day inventory requirement multiplier.
-- Some items are consumed per day (propane tanks, ice bags, fuel cans) — for a
-- 3-day rental you need 3× the listed quantity. Others are static (generator,
-- sandbags) and only need the listed quantity regardless of rental length.

alter table public.product_inventory_requirements
  add column if not exists per_day boolean not null default false;

comment on column public.product_inventory_requirements.per_day is
  'If true, the checklist multiplies quantity by the number of rental days. Use for consumables (propane, fuel, ice).';
