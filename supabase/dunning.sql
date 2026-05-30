-- supabase/dunning.sql
--
-- Auto-dunning state on tenants table. The cron at /api/cron/dunning
-- progresses each past_due tenant through Day 1 → 3 → 7 → 8 emails and
-- finally auto-cancels at day 8 if still unpaid.

alter table public.tenants
  add column if not exists dunning_started_at timestamptz,
  add column if not exists dunning_emails_sent jsonb default '[]'::jsonb,
  add column if not exists dunning_last_action_at timestamptz,
  add column if not exists dunning_recovered_at timestamptz;

create index if not exists tenants_dunning_active_idx
  on tenants (dunning_started_at)
  where dunning_started_at is not null and dunning_recovered_at is null;
