-- supabase/tenant_calendar_feed.sql
--
-- Each tenant gets a secret token that lets them subscribe their
-- bookings calendar in Google Cal / Apple Cal / Outlook via ICS feed.
-- The token is in the URL path so calendar apps (which can't send
-- Authorization headers) can authenticate.

alter table public.tenants
  add column if not exists calendar_feed_token text;

create unique index if not exists tenants_calendar_token_idx
  on tenants (calendar_feed_token) where calendar_feed_token is not null;
