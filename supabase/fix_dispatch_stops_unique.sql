-- supabase/fix_dispatch_stops_unique.sql
--
-- dispatch_stops had `unique (booking_id)` which allowed each booking to
-- be in ONLY ONE route — but the dispatch flow assigns each booking to
-- BOTH a delivery route AND a pickup route (auto-mirror). The unique
-- constraint blocked the second assignment silently.
--
-- Fix: drop the global booking_id unique, replace with composite
-- unique on (booking_id, route_id) which prevents duplicate stops
-- within the same route while allowing delivery + pickup as separate
-- stops on different routes.

alter table public.dispatch_stops
  drop constraint if exists dispatch_stops_booking_id_key;

-- Some installations may have the constraint with a different generated name.
-- Drop any single-column unique on booking_id as a safety net.
do $$
declare con record;
begin
  for con in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'dispatch_stops'
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and exists (
        select 1 from pg_attribute a
        where a.attrelid = t.oid
          and a.attnum = c.conkey[1]
          and a.attname = 'booking_id'
      )
  loop
    execute format('alter table public.dispatch_stops drop constraint %I', con.conname);
  end loop;
end $$;

-- Add the composite unique (booking_id, route_id) so a booking can be
-- on multiple routes but not duplicated within the same route.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dispatch_stops_booking_route_key'
  ) then
    alter table public.dispatch_stops
      add constraint dispatch_stops_booking_route_key unique (booking_id, route_id);
  end if;
end $$;
