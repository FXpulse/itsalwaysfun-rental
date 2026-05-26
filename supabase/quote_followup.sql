-- Track whether a quote follow-up reminder was sent (so the cron only
-- sends ONE reminder per quote, not daily).

alter table public.quotes
  add column if not exists followup_sent_at timestamptz;

create index if not exists quotes_followup_pending_idx
  on public.quotes(sent_at)
  where status in ('sent', 'viewed') and followup_sent_at is null;
