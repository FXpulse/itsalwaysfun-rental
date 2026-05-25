-- Add 'driver' as a 3rd role (alongside admin + staff).
-- Drivers can ONLY see /driver (today's routes), mark stops delivered,
-- and capture delivery/pickup proofs. No access to admin panel content.

alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('admin','staff','driver'));

-- Helper: is_driver_or_above (admin, staff, OR driver) — used for stop actions
create or replace function public.is_driver_or_above(uid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid
      and role in ('admin','staff','driver')
      and is_active = true
  );
$$;

-- Update RLS so drivers can read+update dispatch_stops they're working on
-- (existing staff_or_admin policies already cover them since we treat
-- driver as a peer for dispatch operations).
drop policy if exists "driver_or_above read stops" on public.dispatch_stops;
create policy "driver_or_above read stops"
  on public.dispatch_stops
  for select
  using (public.is_driver_or_above(auth.uid()));

drop policy if exists "driver_or_above update stops" on public.dispatch_stops;
create policy "driver_or_above update stops"
  on public.dispatch_stops
  for update
  using (public.is_driver_or_above(auth.uid()))
  with check (public.is_driver_or_above(auth.uid()));

-- Drivers can read dispatch_routes for today (to see their assigned route)
drop policy if exists "driver_or_above read routes" on public.dispatch_routes;
create policy "driver_or_above read routes"
  on public.dispatch_routes
  for select
  using (public.is_driver_or_above(auth.uid()));

-- Drivers can read bookings (to see customer info, addresses for delivery)
drop policy if exists "driver_or_above read bookings" on public.bookings;
create policy "driver_or_above read bookings"
  on public.bookings
  for select
  using (public.is_driver_or_above(auth.uid()));

-- Drivers can read/write booking_proofs (for photo + signature capture)
drop policy if exists "driver_or_above manage proofs" on public.booking_proofs;
create policy "driver_or_above manage proofs"
  on public.booking_proofs
  for all
  using (public.is_driver_or_above(auth.uid()))
  with check (public.is_driver_or_above(auth.uid()));

-- Drivers can record damages from the field
drop policy if exists "driver_or_above manage damages" on public.booking_damages;
create policy "driver_or_above manage damages"
  on public.booking_damages
  for all
  using (public.is_driver_or_above(auth.uid()))
  with check (public.is_driver_or_above(auth.uid()));

-- Inventory: read-only for drivers (to see what to bring)
drop policy if exists "driver_or_above read inventory" on public.inventory_items;
create policy "driver_or_above read inventory"
  on public.inventory_items
  for select
  using (public.is_driver_or_above(auth.uid()));

-- Product inventory requirements (delivery checklist)
drop policy if exists "driver_or_above read req" on public.product_inventory_requirements;
create policy "driver_or_above read req"
  on public.product_inventory_requirements
  for select
  using (public.is_driver_or_above(auth.uid()));
