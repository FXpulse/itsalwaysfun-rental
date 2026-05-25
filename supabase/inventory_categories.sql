-- Inventory categories — manageable list for operational gear (generators,
-- blowers, etc.). Distinct from public.categories (which is for rentable
-- products shown on the public storefront).

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_categories_active_idx
  on public.inventory_categories(is_active, sort_order);

create or replace function public.touch_inventory_categories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists inventory_categories_set_updated_at on public.inventory_categories;
create trigger inventory_categories_set_updated_at
  before update on public.inventory_categories
  for each row execute function public.touch_inventory_categories_updated_at();

-- Seed with the previously-hardcoded suggestion list (idempotent)
insert into public.inventory_categories (name, sort_order) values
  ('Generators', 10),
  ('Blowers', 20),
  ('Cables & Power', 30),
  ('Anchors & Stakes', 40),
  ('Tarps', 50),
  ('Cleaning Supplies', 60),
  ('Spare Parts', 70),
  ('Tools', 80),
  ('Vehicles & Trailers', 90),
  ('Other', 999)
on conflict (name) do nothing;

-- Also bring in any category strings already used by existing inventory items
insert into public.inventory_categories (name, sort_order)
select distinct category, 500
from public.inventory_items
where category is not null
  and category <> ''
  and category not in (select name from public.inventory_categories)
on conflict (name) do nothing;

alter table public.inventory_categories enable row level security;

drop policy if exists "staff_or_admin read inventory categories" on public.inventory_categories;
create policy "staff_or_admin read inventory categories"
  on public.inventory_categories for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage inventory categories" on public.inventory_categories;
create policy "admin manage inventory categories"
  on public.inventory_categories for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
