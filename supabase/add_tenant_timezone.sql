-- supabase/add_tenant_timezone.sql
--
-- Adds per-tenant timezone so each tenant's bookings, emails, and admin
-- dashboards display times in their local zone — not Vercel's UTC default
-- and not the viewer's browser timezone.
--
-- The column is text holding an IANA timezone identifier (e.g.
-- "America/New_York", "America/Los_Angeles", "America/Chicago",
-- "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
-- "America/Puerto_Rico").
--
-- Default = America/New_York because the existing tenant (IAF) is in FL.
-- New tenants pick their TZ during onboarding.

alter table public.tenants
  add column if not exists timezone text not null default 'America/New_York';

comment on column public.tenants.timezone is
  'IANA timezone identifier used for displaying timestamps in admin + emails. Default America/New_York.';

-- Backfill: anyone without a timezone gets the default (defensive — the
-- DEFAULT clause above already handles new rows, this is for any rows
-- inserted before the migration that somehow have NULL).
update public.tenants set timezone = 'America/New_York' where timezone is null;
