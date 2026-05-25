-- Per-product inventory requirements (delivery checklist).
-- Each row: this product needs N of this inventory item, optionally only
-- when the booking surface matches or when the customer needs power supply.

create table if not exists public.product_inventory_requirements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  -- Conditional: only required when booking's surface matches one of these.
  -- NULL or empty array → required regardless of surface.
  surface_types text[],
  -- Conditional: only when customer needs power supply
  only_when_needs_power boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_inv_req_product_idx on public.product_inventory_requirements(product_id);
create index if not exists product_inv_req_inventory_idx on public.product_inventory_requirements(inventory_item_id);

create or replace function public.touch_product_inv_req_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists product_inv_req_set_updated_at on public.product_inventory_requirements;
create trigger product_inv_req_set_updated_at
  before update on public.product_inventory_requirements
  for each row execute function public.touch_product_inv_req_updated_at();

-- Track delivery checklist completion on bookings
alter table public.bookings
  add column if not exists delivery_checked_at timestamptz,
  add column if not exists delivery_checked_by text;

-- RLS: staff or admin can read, admin can write
alter table public.product_inventory_requirements enable row level security;

drop policy if exists "staff or admin read req" on public.product_inventory_requirements;
create policy "staff or admin read req"
  on public.product_inventory_requirements
  for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage req" on public.product_inventory_requirements;
create policy "admin manage req"
  on public.product_inventory_requirements
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
