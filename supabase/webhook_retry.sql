-- supabase/webhook_retry.sql
--
-- Extend webhook_deliveries with retry scheduling so the cron at
-- /api/cron/webhook-retry can pick up failed deliveries and re-attempt
-- them with exponential backoff.

alter table public.webhook_deliveries
  add column if not exists next_retry_at timestamptz,
  add column if not exists max_attempts int default 4;

create index if not exists webhook_deliveries_retry_idx
  on webhook_deliveries (next_retry_at)
  where succeeded = false and next_retry_at is not null;
