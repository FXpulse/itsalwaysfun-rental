-- supabase/superadmin_goals.sql
--
-- Goals Ludmila sets for herself ("100 paying tenants by Aug 1").
-- Dashboard shows progress + projected hit date.

create table if not exists public.superadmin_goals (
  id uuid primary key default gen_random_uuid(),
  metric text not null,                 -- 'mrr' | 'active_tenants' | 'paying_tenants' | 'signups_30d'
  target numeric not null,
  target_date date not null,
  label text,                           -- "$10K MRR by Q3" — optional override
  is_active boolean default true,
  created_at timestamptz default now(),
  achieved_at timestamptz
);

create index superadmin_goals_active_idx on superadmin_goals (is_active, target_date);

alter table superadmin_goals enable row level security;
create policy "service_role_full_access" on superadmin_goals
  for all using (auth.role() = 'service_role');
