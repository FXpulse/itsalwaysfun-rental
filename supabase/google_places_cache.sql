-- supabase/google_places_cache.sql
--
-- Cache for Google Places API responses. We resolve a tenant's GBP URL
-- to a place_id once, then cache the details (rating, review_count,
-- reviews) so admin pages load instantly and we control the call rate.
--
-- Daily cron refreshes the cache.

create table if not exists public.google_places_cache (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  -- Source: the GBP URL the tenant pasted in /admin/site
  source_url text,
  -- Resolved place_id (the only stable Google identifier)
  place_id text,
  display_name text,
  formatted_address text,
  rating numeric(3,2),               -- e.g. 4.85
  user_rating_count int,
  reviews jsonb not null default '[]'::jsonb,  -- array of {author, rating, text, time, photoUrl}
  google_maps_uri text,
  -- Sync metadata
  last_synced_at timestamptz not null default now(),
  last_sync_status text default 'ok',
  last_sync_error text
);

alter table public.google_places_cache enable row level security;

create policy "service_role_all" on public.google_places_cache
  for all using (auth.role() = 'service_role');

-- Index by last_synced_at so the cron can pick the stalest tenants first
create index if not exists gpc_stale_idx
  on public.google_places_cache (last_synced_at);
