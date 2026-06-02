-- supabase/google_business_integration.sql
--
-- Per-tenant Google Business Profile (GBP) OAuth integration. Two tables:
--
-- 1. google_business_connections — per-tenant OAuth tokens + the location
--    they manage. One tenant = one connection (their primary location).
--
-- 2. google_business_reviews — cached reviews pulled from GBP API daily.
--    We cache so the admin UI loads instantly and we can show new vs
--    replied reviews. Source of truth is still GBP, but cache lets us
--    track local state (replied_at) for unread badges.
--
-- 3. google_business_posts — log of posts we've made via the API so admin
--    can see history + retry failed ones.

create table if not exists public.google_business_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- The Google account that connected — used in revoke flow
  google_email text,
  -- GBP location identifier (e.g. "accounts/<id>/locations/<id>")
  location_id text,
  -- Display name of the location (e.g. "It's Always Fun, LLC — Jacksonville")
  location_name text,
  -- Address pulled from GBP — for display + verification it's the right location
  location_address text,
  -- OAuth tokens. access_token rotates every ~1hr — refresh_token is the
  -- long-lived one Google issues on first consent.
  access_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token text not null,
  -- Scopes granted by the user — defensive in case Google revokes some
  scopes text[] not null default array[]::text[],
  -- Lifecycle
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_status text,    -- 'ok' | 'auth_failed' | 'rate_limited' | 'api_error'
  last_sync_error text,
  -- One active connection per tenant — disconnect/reconnect replaces in place
  unique (tenant_id)
);

create index if not exists gbp_connections_tenant_idx
  on public.google_business_connections (tenant_id);

create table if not exists public.google_business_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- GBP review name (e.g. "accounts/.../locations/.../reviews/<id>")
  gbp_review_name text not null,
  reviewer_display_name text,
  reviewer_photo_url text,
  -- 1-5 star rating
  star_rating int check (star_rating between 1 and 5),
  comment text,
  -- When the customer left the review on Google
  reviewed_at timestamptz,
  -- Our reply, if any (synced back from GBP)
  reply_comment text,
  reply_updated_at timestamptz,
  -- Sync metadata
  first_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  -- Idempotency
  unique (tenant_id, gbp_review_name)
);

create index if not exists gbp_reviews_tenant_idx
  on public.google_business_reviews (tenant_id, reviewed_at desc);

-- New reviews need attention (no reply yet) — index helps the unread badge
create index if not exists gbp_reviews_unread_idx
  on public.google_business_reviews (tenant_id, reviewed_at desc)
  where reply_comment is null;

create table if not exists public.google_business_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Generated GBP local post name after successful create
  gbp_post_name text,
  -- Payload we sent to GBP API (for debugging + retries)
  topic_type text not null,    -- 'STANDARD' | 'OFFER' | 'EVENT' | 'ALERT'
  summary text not null,        -- The body
  call_to_action_type text,     -- 'BOOK' | 'LEARN_MORE' | 'ORDER' | 'CALL' etc
  call_to_action_url text,
  media_url text,               -- Optional photo
  -- Lifecycle
  status text not null default 'pending',  -- 'pending' | 'posted' | 'failed' | 'deleted'
  posted_at timestamptz,
  failed_reason text,
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists gbp_posts_tenant_idx
  on public.google_business_posts (tenant_id, created_at desc);

-- RLS
alter table public.google_business_connections enable row level security;
alter table public.google_business_reviews enable row level security;
alter table public.google_business_posts enable row level security;

create policy "service_role_all" on public.google_business_connections
  for all using (auth.role() = 'service_role');
create policy "service_role_all" on public.google_business_reviews
  for all using (auth.role() = 'service_role');
create policy "service_role_all" on public.google_business_posts
  for all using (auth.role() = 'service_role');
