-- Fleet management + dispatch routes for delivery planning.

-- ─── FLEET ────────────────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- "Truck 1", "Van A"
  vehicle_type text not null default 'truck' check (vehicle_type in ('truck','van','pickup','other')),
  requires_trailer boolean not null default true,
  capacity_notes text,                       -- "2 large bouncers + accessories"
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- "Trailer A (16ft)"
  capacity_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_fleet_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.touch_fleet_updated_at();

drop trigger if exists trailers_set_updated_at on public.trailers;
create trigger trailers_set_updated_at
  before update on public.trailers
  for each row execute function public.touch_fleet_updated_at();

-- ─── DISPATCH ROUTES ──────────────────────────────────────────────────────
create table if not exists public.dispatch_routes (
  id uuid primary key default gen_random_uuid(),
  route_date date not null,                  -- the event date (delivery day)
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  trailer_id uuid references public.trailers(id) on delete set null,
  driver_name text,
  notes text,
  status text not null default 'planned' check (status in ('planned','loaded','out','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dispatch_routes_date_idx on public.dispatch_routes(route_date);

create table if not exists public.dispatch_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.dispatch_routes(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stop_order int not null default 0,
  notes text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id)                        -- a booking can only be in ONE route
);

create index if not exists dispatch_stops_route_idx on public.dispatch_stops(route_id, stop_order);
create index if not exists dispatch_stops_booking_idx on public.dispatch_stops(booking_id);

drop trigger if exists dispatch_routes_set_updated_at on public.dispatch_routes;
create trigger dispatch_routes_set_updated_at
  before update on public.dispatch_routes
  for each row execute function public.touch_fleet_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.vehicles enable row level security;
alter table public.trailers enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_stops enable row level security;

-- Staff/admin can read fleet + dispatch
drop policy if exists "staff_or_admin read vehicles" on public.vehicles;
create policy "staff_or_admin read vehicles" on public.vehicles
  for select using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage vehicles" on public.vehicles;
create policy "admin manage vehicles" on public.vehicles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "staff_or_admin read trailers" on public.trailers;
create policy "staff_or_admin read trailers" on public.trailers
  for select using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "admin manage trailers" on public.trailers;
create policy "admin manage trailers" on public.trailers
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "staff_or_admin read routes" on public.dispatch_routes;
create policy "staff_or_admin read routes" on public.dispatch_routes
  for select using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin manage routes" on public.dispatch_routes;
create policy "staff_or_admin manage routes" on public.dispatch_routes
  for all using (public.is_staff_or_admin(auth.uid())) with check (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin read stops" on public.dispatch_stops;
create policy "staff_or_admin read stops" on public.dispatch_stops
  for select using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin manage stops" on public.dispatch_stops;
create policy "staff_or_admin manage stops" on public.dispatch_stops
  for all using (public.is_staff_or_admin(auth.uid())) with check (public.is_staff_or_admin(auth.uid()));

-- ─── SEED ─────────────────────────────────────────────────────────────────
insert into public.vehicles (name, vehicle_type, requires_trailer, capacity_notes) values
  ('Truck 1', 'truck', true, 'Pulls trailer — 2-3 large bouncers'),
  ('Van A', 'van', false, 'Small to medium bouncers + accessories direct')
on conflict do nothing;

insert into public.trailers (name, capacity_notes) values
  ('Trailer A (16ft)', '2 large bouncers + accessories'),
  ('Trailer B (12ft)', '1 large or 2 small bouncers')
on conflict do nothing;
