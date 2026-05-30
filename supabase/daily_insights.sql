-- supabase/daily_insights.sql
--
-- AI-generated daily summary for the operator. One row per day. Generated
-- on first dashboard load of the day (idempotent — once today's row exists,
-- no further OpenAI calls until tomorrow).

create table if not exists public.daily_insights (
  id uuid primary key default gen_random_uuid(),
  insight_date date unique not null default current_date,
  whats_working text,
  needs_attention text,
  today_focus text,
  raw_content text,
  generated_at timestamptz default now()
);

alter table public.daily_insights enable row level security;

create policy "service_role_full_access" on public.daily_insights
  for all using (auth.role() = 'service_role');
