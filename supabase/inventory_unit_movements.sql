-- Asset Movement state machine para inventory_units.
-- ERPNext-inspired (Asset Movement entries): append-only log de cambios de
-- estado por unit + cache column en inventory_units para queries fast.
--
-- Estados:
--   warehouse        — physical en el warehouse, available
--   loading          — pre-load: marcado para una booking but todavía no en truck
--   on_truck         — cargado a un truck (dispatch_routes route_id)
--   at_customer      — entregado al customer, en uso
--   returning        — recogido pero todavía no en warehouse (in transit)
--   maintenance      — fuera de servicio para repair/clean (no available para bookings)
--   retired          — permanently out of service
--
-- Transiciones típicas:
--   warehouse → loading → on_truck → at_customer → returning → warehouse
--   warehouse → maintenance → warehouse (after cleaning/repair)
--   * → retired (terminal)

create table if not exists public.inventory_unit_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  inventory_unit_id uuid not null references public.inventory_units(id) on delete cascade,
  -- El estado al que la unidad fue movida en este evento
  to_state text not null check (to_state in (
    'warehouse','loading','on_truck','at_customer','returning','maintenance','retired'
  )),
  -- Estado previo (snapshot — útil para auditar transiciones inválidas)
  from_state text,
  -- Vínculos opcionales con la booking / route que disparó el movimiento
  booking_id uuid references public.bookings(id) on delete set null,
  route_id uuid references public.dispatch_routes(id) on delete set null,
  -- Quién hizo el movimiento (user, o "system" si fue auto-trigger)
  performed_by_user_id uuid references auth.users(id) on delete set null,
  performed_by_name text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists inventory_unit_movements_unit_idx
  on public.inventory_unit_movements(inventory_unit_id, occurred_at desc);
create index if not exists inventory_unit_movements_booking_idx
  on public.inventory_unit_movements(booking_id) where booking_id is not null;
create index if not exists inventory_unit_movements_tenant_recent_idx
  on public.inventory_unit_movements(tenant_id, occurred_at desc);

-- ─── Cache column en inventory_units ────────────────────────────────
-- Para queries "qué units están libres el sábado?" sin tener que joinear
-- contra movements + last() todo el tiempo. Se mantiene via trigger.

alter table public.inventory_units
  add column if not exists current_state text not null default 'warehouse'
    check (current_state in (
      'warehouse','loading','on_truck','at_customer','returning','maintenance','retired'
    )),
  add column if not exists current_booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists state_changed_at timestamptz not null default now();

create index if not exists inventory_units_state_idx
  on public.inventory_units(current_state) where is_active = true;

-- ─── Trigger: cuando insertás un movement, actualizá el cache ──────
create or replace function public.touch_unit_state_after_movement()
returns trigger language plpgsql as $$
begin
  update public.inventory_units
    set current_state = new.to_state,
        current_booking_id = new.booking_id,
        state_changed_at = new.occurred_at,
        updated_at = now()
    where id = new.inventory_unit_id;
  return new;
end;
$$;

drop trigger if exists inventory_unit_movements_touch_cache on public.inventory_unit_movements;
create trigger inventory_unit_movements_touch_cache
  after insert on public.inventory_unit_movements
  for each row execute function public.touch_unit_state_after_movement();

-- ─── RLS ────────────────────────────────────────────────────────────
alter table public.inventory_unit_movements enable row level security;

drop policy if exists "staff_or_admin manage inventory_unit_movements"
  on public.inventory_unit_movements;
create policy "staff_or_admin manage inventory_unit_movements"
  on public.inventory_unit_movements
  for all
  using (
    public.is_staff_or_admin(auth.uid())
    or exists (select 1 from public.user_roles ur
               where ur.user_id = auth.uid() and ur.role = 'driver' and ur.is_active)
  )
  with check (
    public.is_staff_or_admin(auth.uid())
    or exists (select 1 from public.user_roles ur
               where ur.user_id = auth.uid() and ur.role = 'driver' and ur.is_active)
  );
