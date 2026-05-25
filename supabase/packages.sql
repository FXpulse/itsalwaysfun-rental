-- Package deals (bundles): pre-configured set of products with a single
-- combined price. Customer reserves the bundle like one product, internally
-- it reserves the whole list.

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  image_url text,
  price_cents int not null check (price_cents >= 0),
  -- items in the bundle: [{ product_id, quantity, name (denormalized for snapshot) }]
  items jsonb not null default '[]'::jsonb,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists packages_active_idx on public.packages(is_active, display_order);

-- Link a booking to a package (nullable — most bookings won't be from a package)
alter table public.bookings
  add column if not exists package_id uuid references public.packages(id) on delete set null,
  add column if not exists package_snapshot jsonb;
-- package_snapshot = full package row at time of booking, so if admin
-- edits the package later, the booking's package details remain.

create or replace function public.touch_packages_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.touch_packages_updated_at();

alter table public.packages enable row level security;

drop policy if exists "public read active packages" on public.packages;
create policy "public read active packages"
  on public.packages
  for select
  using (is_active = true);

drop policy if exists "admin manage packages" on public.packages;
create policy "admin manage packages"
  on public.packages
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
