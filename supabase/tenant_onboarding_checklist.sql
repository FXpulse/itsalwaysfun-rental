-- supabase/tenant_onboarding_checklist.sql
--
-- Three tables to support the per-tenant checklist + client file ("ficha")
-- in /superadmin/tenants/[id]/checklist:
--
-- 1. tenant_onboarding_checklist — per-tenant per-item status. Auto-detected
--    items are toggled by the auto-detection function on load. Manual items
--    are toggled by operator click.
-- 2. tenant_operator_notes — timeline of operator notes per tenant (call,
--    email, meeting, issue, follow-up).
-- 3. tenant_profile — additional client information beyond what's in the
--    tenants table (industry, employees, goals, pain points, status).

create table if not exists public.tenant_onboarding_checklist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  item_key text not null,                  -- e.g. 'stripe_connected', 'first_product'
  is_completed boolean default false,
  completed_at timestamptz,
  completed_by_email text,
  notes text,                              -- per-item operator notes
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, item_key)
);

create index tenant_checklist_tenant_idx on tenant_onboarding_checklist (tenant_id);

create table if not exists public.tenant_operator_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  note_type text not null,                 -- 'call' | 'email' | 'meeting' | 'issue' | 'follow_up' | 'general'
  subject text,
  body text not null,
  follow_up_date date,
  is_resolved boolean default false,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  created_by_email text
);

create index tenant_notes_tenant_idx on tenant_operator_notes (tenant_id, created_at desc);
create index tenant_notes_followup_idx on tenant_operator_notes (follow_up_date)
  where follow_up_date is not null and is_resolved = false;

create table if not exists public.tenant_profile (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  industry text,                           -- 'bouncy_house' | 'party_rental' | 'event_rental' | 'equipment' | 'other'
  employees_count int,
  year_founded int,
  market_size text,                        -- 'local' | 'regional' | 'multi_state'
  primary_goal text,                       -- what they want to achieve
  pain_points text,                        -- biggest challenges
  bookings_per_month_avg int,
  revenue_tier text,                       -- '<10k' | '10k-50k' | '50k-200k' | '200k+'
  decision_maker_name text,
  decision_maker_phone text,
  decision_maker_role text,
  acquisition_source text,                 -- 'cold_email' | 'referral' | 'organic' | 'paid' | 'word_of_mouth'
  account_status text default 'prospect',  -- 'prospect' | 'trial' | 'active' | 'at_risk' | 'churned'
  notes text,                              -- free-form operator notes
  updated_at timestamptz default now(),
  updated_by_email text
);

alter table tenant_onboarding_checklist enable row level security;
alter table tenant_operator_notes enable row level security;
alter table tenant_profile enable row level security;

create policy "service_role_full_access" on tenant_onboarding_checklist
  for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on tenant_operator_notes
  for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on tenant_profile
  for all using (auth.role() = 'service_role');
