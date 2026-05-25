-- Add pickup routes alongside delivery routes — same dispatch infrastructure
-- but with route_type distinguishing the two flows.

alter table public.dispatch_routes
  add column if not exists route_type text not null default 'delivery'
    check (route_type in ('delivery', 'pickup'));

create index if not exists dispatch_routes_type_date_idx
  on public.dispatch_routes(route_type, route_date);

-- Drop the strict unique on booking_id (a booking can be in 1 delivery + 1 pickup).
-- Uniqueness is enforced in app code via assignBookingToRoute (same-type check).
alter table public.dispatch_stops
  drop constraint if exists dispatch_stops_booking_id_key;
