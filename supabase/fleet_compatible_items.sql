-- Per-vehicle/trailer compatibility list: which special inventory items this
-- fleet unit can mount/carry (electric dolly, ramps, lifts, oversized cargo).
-- Lets dispatch flag mismatches before sending a truck without the right gear.

alter table public.vehicles
  add column if not exists compatible_inventory_item_ids uuid[] not null default '{}';

alter table public.trailers
  add column if not exists compatible_inventory_item_ids uuid[] not null default '{}';

-- GIN indexes so we can query "which fleet units support item X?"
create index if not exists vehicles_compatible_items_idx
  on public.vehicles using gin (compatible_inventory_item_ids);
create index if not exists trailers_compatible_items_idx
  on public.trailers using gin (compatible_inventory_item_ids);

comment on column public.vehicles.compatible_inventory_item_ids is
  'List of inventory_items.id that this vehicle can mount/carry (e.g. electric dolly, ramps). Used at dispatch time to warn about mismatches.';
comment on column public.trailers.compatible_inventory_item_ids is
  'Same as vehicles.compatible_inventory_item_ids — for trailers.';
