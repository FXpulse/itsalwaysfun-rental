-- supabase/custom_reports.sql
--
-- Saved report definitions. Each tenant builds their own. The "definition"
-- jsonb describes which dimensions / metrics / filters to apply at query
-- time (see lib/admin/report-engine.ts for the schema).

create table if not exists public.custom_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  definition jsonb not null,        -- { dimensions, metrics, filters, chart_type, sort }
  is_favorite boolean default false,
  last_viewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by_email text
);

create index custom_reports_tenant_idx on custom_reports (tenant_id, created_at desc);

alter table custom_reports enable row level security;

create policy "service_role_full_access" on custom_reports
  for all using (auth.role() = 'service_role');

create policy "tenant_members_full_access" on custom_reports
  for all using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );
