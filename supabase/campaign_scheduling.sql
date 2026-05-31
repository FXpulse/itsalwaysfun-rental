-- supabase/campaign_scheduling.sql
--
-- Add scheduling to campaigns. When scheduled_at is set + status='scheduled',
-- the cron at /api/cron/campaign-sender picks it up at that time + sends.
-- Audience is RE-EVALUATED at send time (not snapshotted), so tags added
-- between schedule and send are included.

alter table public.campaigns
  add column if not exists scheduled_at timestamptz;

create index if not exists campaigns_scheduled_idx
  on campaigns (scheduled_at)
  where status = 'scheduled';
