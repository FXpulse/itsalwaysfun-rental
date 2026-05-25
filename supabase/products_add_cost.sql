-- Add internal product cost (COGS) for margin tracking. Not visible to customers.
alter table public.products
  add column if not exists cost_cents int not null default 0 check (cost_cents >= 0);

comment on column public.products.cost_cents is
  'Internal: what the product cost to acquire. Used for margin/ROI analysis. NEVER exposed to public.';
