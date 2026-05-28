-- Per-tenant configurable list of "setup surface" options shown to
-- customers in the public booking wizard + the quote approval form.
-- Previously this list was hardcoded as ('dirt','grass','concrete',
-- 'paver','asphalt','other') with a CHECK constraint on bookings.surface_type
-- and quotes.surface_type — admins couldn't add/remove options. Now they can.
--
-- Drops the CHECK constraints so any string is allowed. Validity is enforced
-- at the application layer against the tenant's active setup_surfaces rows.

create table if not exists public.setup_surfaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  value text not null,
  label text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, value)
);

create index if not exists setup_surfaces_tenant_active_idx
  on public.setup_surfaces(tenant_id, is_active, display_order);

alter table public.setup_surfaces enable row level security;

drop policy if exists "tenant read surfaces" on public.setup_surfaces;
create policy "tenant read surfaces"
  on public.setup_surfaces
  for select
  using (true);  -- public read so the booking wizard can fetch them anonymously

drop policy if exists "admin manage surfaces" on public.setup_surfaces;
create policy "admin manage surfaces"
  on public.setup_surfaces
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Drop the old hardcoded CHECK constraints so any value works
alter table public.bookings drop constraint if exists bookings_surface_type_check;
alter table public.quotes drop constraint if exists quotes_surface_type_check;

-- Seed the 6 historical defaults for every existing tenant.
-- Idempotent via unique(tenant_id, value).
insert into public.setup_surfaces (tenant_id, value, label, display_order)
select t.id, v.value, v.label, v.ord
from public.tenants t
cross join (values
  ('grass',    'Grass',    0),
  ('dirt',     'Dirt',     1),
  ('concrete', 'Concrete', 2),
  ('paver',    'Paver',    3),
  ('asphalt',  'Asphalt',  4),
  ('other',    'Other',    5)
) as v(value, label, ord)
on conflict (tenant_id, value) do nothing;

-- SECURITY DEFINER seed function used by signup for new tenants.
create or replace function public.seed_default_setup_surfaces(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.setup_surfaces (tenant_id, value, label, display_order)
  values
    (p_tenant_id, 'grass',    'Grass',    0),
    (p_tenant_id, 'dirt',     'Dirt',     1),
    (p_tenant_id, 'concrete', 'Concrete', 2),
    (p_tenant_id, 'paver',    'Paver',    3),
    (p_tenant_id, 'asphalt',  'Asphalt',  4),
    (p_tenant_id, 'other',    'Other',    5)
  on conflict (tenant_id, value) do nothing;
end;
$$;

revoke all on function public.seed_default_setup_surfaces(uuid) from public;
grant execute on function public.seed_default_setup_surfaces(uuid) to authenticated, service_role;

comment on table public.setup_surfaces is
  'Per-tenant list of setup surface options ("Grass", "Dirt", etc.) shown to customers in the booking wizard and quote approval form. Admins manage at /admin/categories.';
