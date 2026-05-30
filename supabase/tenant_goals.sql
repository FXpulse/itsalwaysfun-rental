-- supabase/tenant_goals.sql
--
-- Tenant-side goals — same pattern as superadmin_goals but per-tenant.
-- Different metrics: bookings/month, revenue/month, customers/month,
-- repeat customer %.

create table if not exists public.tenant_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric text not null,                 -- 'bookings_30d' | 'revenue_30d' | 'customers_30d' | 'repeat_rate'
  target numeric not null,
  target_date date not null,
  label text,
  is_active boolean default true,
  created_at timestamptz default now(),
  achieved_at timestamptz
);

create index tenant_goals_tenant_idx on tenant_goals (tenant_id, is_active, target_date);

alter table tenant_goals enable row level security;

create policy "service_role_full_access" on tenant_goals
  for all using (auth.role() = 'service_role');

create policy "tenant_members_read" on tenant_goals
  for select using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );
