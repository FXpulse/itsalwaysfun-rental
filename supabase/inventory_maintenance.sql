-- Structured maintenance log per inventory item (separate from the free-text
-- maintenance_notes column already on inventory_items).

create table if not exists public.inventory_maintenance (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  type text not null check (type in ('cleaning','repair','inspection','replacement','other')),
  description text not null,
  cost_cents int not null default 0 check (cost_cents >= 0),
  performed_by text,
  performed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_maintenance_item_idx
  on public.inventory_maintenance(inventory_item_id, performed_at desc);
create index if not exists inventory_maintenance_type_idx
  on public.inventory_maintenance(type);

alter table public.inventory_maintenance enable row level security;

drop policy if exists "staff_or_admin read maintenance" on public.inventory_maintenance;
create policy "staff_or_admin read maintenance"
  on public.inventory_maintenance
  for select
  using (public.is_staff_or_admin(auth.uid()));

drop policy if exists "staff_or_admin manage maintenance" on public.inventory_maintenance;
create policy "staff_or_admin manage maintenance"
  on public.inventory_maintenance
  for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));
