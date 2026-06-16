-- Inspection templates + booking inspections (ERPNext-inspired Quality Inspection)
--
-- Hoy en RentalFlow tenemos booking_proofs (photos en delivery) y booking_damages
-- (post-incident logging), pero NO un checklist estructurado que el driver
-- completa antes/después de cada rental.
--
-- Caso de uso: tenant define una vez "Bouncer Delivery Checklist" con 5 items:
--   1. Blower funciona
--   2. Anchors/stakes incluidos
--   3. Sin rips / sin tears
--   4. Clean
--   5. Manual del cliente entregado
-- Driver completa el checklist en /driver o admin lo registra en /admin/bookings/[id].
-- Se guarda con fotos + notas + timestamp + inspector name → resuelve disputas
-- "estaba dañado cuando llegó" + audit trail para insurance.

-- ─── A) Templates ──────────────────────────────────────────────
create table if not exists public.inspection_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  -- Scope opcional: si product_id está set, este template se sugiere automáticamente
  -- cuando el booking contiene ese producto. Si category_id está set, se sugiere
  -- para todos los productos de esa categoría. Si ninguno, es global del tenant.
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  -- items: array de checklist labels. Ej:
  -- [
  --   {"key":"blower","label":"Blower funciona"},
  --   {"key":"stakes","label":"Anchors/stakes presentes"},
  --   {"key":"rips","label":"Sin rips ni tears"},
  --   {"key":"clean","label":"Limpio"},
  --   {"key":"manual","label":"Manual entregado al cliente"}
  -- ]
  items jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inspection_templates_tenant_active_idx
  on public.inspection_templates(tenant_id, is_active);
create index if not exists inspection_templates_product_idx
  on public.inspection_templates(product_id) where product_id is not null;
create index if not exists inspection_templates_category_idx
  on public.inspection_templates(category_id) where category_id is not null;

-- ─── B) Booking inspections (instances) ────────────────────────
-- Una por booking + type (delivery, pickup). Mantenemos un row por scope para
-- que el historial completo del booking sea queryable como tabla.
create table if not exists public.booking_inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  template_id uuid references public.inspection_templates(id) on delete set null,
  type text not null check (type in ('delivery','pickup','spot_check')),
  -- Snapshot del template al momento de inspeccionar (por si el template cambia
  -- después, el record histórico mantiene el contexto original).
  template_snapshot jsonb not null default '[]'::jsonb,
  -- items_result: array paralelo con resultados:
  -- [
  --   {"key":"blower","status":"pass","notes":null,"photo_urls":[]},
  --   {"key":"stakes","status":"fail","notes":"Faltan 2 stakes","photo_urls":["..."]}
  -- ]
  items_result jsonb not null default '[]'::jsonb,
  inspector_name text,                              -- driver/admin name
  inspector_user_id uuid references auth.users(id) on delete set null,
  overall_status text not null default 'pending'
    check (overall_status in ('pending','passed','failed','passed_with_issues')),
  notes text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_inspections_booking_idx
  on public.booking_inspections(booking_id, type, performed_at desc);
create index if not exists booking_inspections_tenant_perf_idx
  on public.booking_inspections(tenant_id, performed_at desc);
create index if not exists booking_inspections_failed_idx
  on public.booking_inspections(tenant_id, overall_status)
  where overall_status in ('failed','passed_with_issues');

-- ─── C) RLS ────────────────────────────────────────────────────
alter table public.inspection_templates enable row level security;
alter table public.booking_inspections enable row level security;

drop policy if exists "staff_or_admin manage inspection_templates" on public.inspection_templates;
create policy "staff_or_admin manage inspection_templates"
  on public.inspection_templates
  for all
  using (public.is_staff_or_admin(auth.uid()))
  with check (public.is_staff_or_admin(auth.uid()));

drop policy if exists "driver_or_above manage booking_inspections" on public.booking_inspections;
create policy "driver_or_above manage booking_inspections"
  on public.booking_inspections
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

-- ─── D) Touch updated_at trigger ───────────────────────────────
create or replace function public.touch_inspection_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists inspection_templates_touch on public.inspection_templates;
create trigger inspection_templates_touch
  before update on public.inspection_templates
  for each row execute function public.touch_inspection_updated_at();

drop trigger if exists booking_inspections_touch on public.booking_inspections;
create trigger booking_inspections_touch
  before update on public.booking_inspections
  for each row execute function public.touch_inspection_updated_at();
