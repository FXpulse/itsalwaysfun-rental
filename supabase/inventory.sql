-- Phase C: inventory_items — track operational gear that isn't a rentable product.
-- Examples: generators, blowers, extension cords, anchors, sandbags, tarps,
-- cleaning supplies, spare parts, vehicles, trailers, tools.
--
-- Different from `products` (which customers rent).
-- Different from `categories` (those are for products).

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',          -- freeform: generators, supplies, etc.
  description text,
  quantity_owned int not null default 1 check (quantity_owned >= 0),
  quantity_in_use int not null default 0 check (quantity_in_use >= 0),
  location text,                                    -- e.g. "Warehouse A", "Truck 1", "In field"
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

create index if not exists inventory_items_category_idx on public.inventory_items(category);
create index if not exists inventory_items_condition_idx on public.inventory_items(condition);
create index if not exists inventory_items_is_active_idx on public.inventory_items(is_active);

-- Touch updated_at on changes
create or replace function public.touch_inventory_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.touch_inventory_updated_at();

-- RLS: only staff or admin can read/write
alter table public.inventory_items enable row level security;

drop policy if exists "staff_or_admin can read inventory" on public.inventory_items;
create policy "staff_or_admin can read inventory"
  on public.inventory_items
  for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin can write inventory" on public.inventory_items;
create policy "admin can write inventory"
  on public.inventory_items
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Staff can update only quantity_in_use, condition, location, notes (operational fields)
-- but not delete or change cost. Implemented via separate policy:
drop policy if exists "staff can update operational fields" on public.inventory_items;
create policy "staff can update operational fields"
  on public.inventory_items
  for update
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));

-- Seed a few common items so the page isn't empty on first visit
insert into public.inventory_items (name, category, quantity_owned, quantity_in_use, location, condition)
values
  ('Honda EU2200i Generator', 'Generators', 2, 0, 'Warehouse', 'good'),
  ('Heavy-duty extension cord 100ft', 'Cables & Power', 6, 0, 'Warehouse', 'good'),
  ('Blower for bounce houses', 'Blowers', 4, 0, 'Warehouse', 'good'),
  ('Ground stakes (set of 8)', 'Anchors & Stakes', 10, 0, 'Warehouse', 'good'),
  ('Sandbag (50 lb)', 'Anchors & Stakes', 20, 0, 'Warehouse', 'good'),
  ('Vinyl cleaner (gallon)', 'Cleaning Supplies', 4, 0, 'Warehouse', 'good'),
  ('Patch kit', 'Spare Parts', 3, 0, 'Warehouse', 'good')
on conflict do nothing;
