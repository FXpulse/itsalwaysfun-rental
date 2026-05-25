-- Physical unit tracking for inventory items.
-- Lets you split "14 blowers" into BLW-01...BLW-14 so you know exactly which
-- physical unit went on which truck. Optional per-item — most things (sandbags,
-- cables) don't need unit-level tracking, but generators/blowers/large items do.

-- ── 1. Toggle on inventory_items: enable per-unit tracking ─────
alter table public.inventory_items
  add column if not exists tracks_units boolean not null default false,
  add column if not exists unit_tag_prefix text;  -- e.g. "BLW" → BLW-01

-- ── 2. Physical units table ────────────────────────────────────
create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  tag text not null,                              -- "BLW-01" (unique within an item)
  serial_number text,                             -- manufacturer's SN (optional)
  condition text not null default 'good'
    check (condition in ('good', 'needs_repair', 'broken', 'retired')),
  notes text,
  acquired_date date,
  retired_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inventory_item_id, tag)                 -- tag is unique per item
);

create index if not exists inventory_units_item_idx
  on public.inventory_units(inventory_item_id, is_active, tag);

create or replace function public.touch_inventory_units_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists inventory_units_set_updated_at on public.inventory_units;
create trigger inventory_units_set_updated_at
  before update on public.inventory_units
  for each row execute function public.touch_inventory_units_updated_at();

-- ── 3. Link table: which units were assigned to a dispatch route ──
-- (route-level, not stop-level — admin assigns to a truck, not a specific stop)
create table if not exists public.dispatch_route_units (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.dispatch_routes(id) on delete cascade,
  unit_id uuid not null references public.inventory_units(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by text,
  returned_at timestamptz,
  return_condition text
    check (return_condition is null or return_condition in ('good', 'needs_repair', 'broken')),
  return_note text,
  unique (route_id, unit_id)
);

create index if not exists dispatch_route_units_route_idx
  on public.dispatch_route_units(route_id);
create index if not exists dispatch_route_units_unit_idx
  on public.dispatch_route_units(unit_id, returned_at);

-- ── RLS ────────────────────────────────────────────────────────
alter table public.inventory_units enable row level security;
alter table public.dispatch_route_units enable row level security;

drop policy if exists "staff_or_admin read inventory units" on public.inventory_units;
create policy "staff_or_admin read inventory units"
  on public.inventory_units for select
  using (public.is_staff_or_admin(auth.uid()));
drop policy if exists "admin manage inventory units" on public.inventory_units;
create policy "admin manage inventory units"
  on public.inventory_units for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "driver_or_above read route units" on public.dispatch_route_units;
create policy "driver_or_above read route units"
  on public.dispatch_route_units for select
  using (public.is_driver_or_above(auth.uid()));
drop policy if exists "driver_or_above update route units" on public.dispatch_route_units;
create policy "driver_or_above update route units"
  on public.dispatch_route_units for update
  using (public.is_driver_or_above(auth.uid()))
  with check (public.is_driver_or_above(auth.uid()));
drop policy if exists "staff_or_admin manage route units" on public.dispatch_route_units;
create policy "staff_or_admin manage route units"
  on public.dispatch_route_units for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));

-- ── Helper: bulk-generate units for an item ────────────────────
-- Usage: select public.generate_inventory_units('<item-uuid>', 14, 'BLW');
-- → creates BLW-01..BLW-14 (or appends after existing). Skips on conflict.
create or replace function public.generate_inventory_units(
  p_item_id uuid,
  p_count int,
  p_prefix text
)
returns int language plpgsql as $$
declare
  v_existing_count int;
  v_target_count int;
  v_padding int;
  v_tag text;
  v_inserted int := 0;
begin
  if p_count <= 0 then return 0; end if;
  if p_count > 999 then raise exception 'Count too high (max 999)'; end if;

  select count(*) into v_existing_count from public.inventory_units
   where inventory_item_id = p_item_id;

  -- Pad to 2 or 3 digits depending on total
  v_target_count := v_existing_count + p_count;
  v_padding := case when v_target_count >= 100 then 3 else 2 end;

  for i in (v_existing_count + 1)..(v_existing_count + p_count) loop
    v_tag := upper(p_prefix) || '-' || lpad(i::text, v_padding, '0');
    begin
      insert into public.inventory_units (inventory_item_id, tag)
      values (p_item_id, v_tag);
      v_inserted := v_inserted + 1;
    exception when unique_violation then
      -- tag taken (shouldn't happen with sequential numbering but safe-guard)
      null;
    end;
  end loop;

  -- Auto-enable tracks_units + set prefix on the parent item
  update public.inventory_items
     set tracks_units = true,
         unit_tag_prefix = coalesce(unit_tag_prefix, upper(p_prefix))
   where id = p_item_id;

  return v_inserted;
end;
$$;
