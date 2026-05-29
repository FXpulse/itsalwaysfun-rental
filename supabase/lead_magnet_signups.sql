-- supabase/lead_magnet_signups.sql
--
-- Marketing leads captured by free-tools landings (e.g. /free-tools/1099-tracker).
-- NOT tenant-scoped: these are RentalFlow's own marketing prospects, not data
-- belonging to any tenant's rental business.
--
-- payload_json holds whatever the source page wants to track (e.g. the tracker
-- summary: driver_count, drivers_over_threshold, total_paid_cents, tax_year).

create table public.lead_magnet_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tool_name text not null,
  source text,
  payload_json jsonb not null default '{}'::jsonb,
  marketing_opt_in boolean default false,
  ghl_synced_at timestamptz,
  ghl_contact_id text,
  created_at timestamptz default now()
);

create index lead_magnet_signups_email_idx on public.lead_magnet_signups (email);
create index lead_magnet_signups_tool_created_idx
  on public.lead_magnet_signups (tool_name, created_at desc);
-- Partial index to make the resync cron fast (only rows that still need it).
create index lead_magnet_signups_pending_sync_idx
  on public.lead_magnet_signups (created_at)
  where ghl_synced_at is null;

alter table public.lead_magnet_signups enable row level security;

-- App code uses the service role to write/read. No user-facing reads.
create policy "service_role_full_access" on public.lead_magnet_signups
  for all using (auth.role() = 'service_role');
