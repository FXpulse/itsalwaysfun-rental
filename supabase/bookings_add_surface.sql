-- Add surface type to bookings (where the inflatable will be set up).
-- Helps the crew prep with correct anchors/stakes for the surface.
alter table public.bookings
  add column if not exists surface_type text
    check (surface_type in ('dirt','grass','concrete','paver','asphalt','other'));
