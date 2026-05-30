-- supabase/onboarding_nudges.sql
--
-- Track which onboarding nudges have been sent to each tenant so the cron
-- doesn't double-send.

alter table public.tenants
  add column if not exists onboarding_nudges_sent jsonb default '[]'::jsonb,
  add column if not exists onboarding_last_nudge_at timestamptz;
