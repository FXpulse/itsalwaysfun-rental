-- supabase/customer_tags_and_campaigns.sql
--
-- Two related features:
--   1. customer_tags — admin tags customers (promoter, VIP, inactive, etc.).
--      Email-keyed so it works for both auth.users customers AND booking-only
--      customers (no portal account).
--   2. campaigns — admin builds + sends email campaigns to filtered audiences.
--      Filter by tag, by booking recency, by paid status, etc.

create table if not exists public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_email text not null,             -- lowercase canonical email
  tag_name text not null,                   -- e.g. "promoter", "vip", "inactive"
  tag_color text default '#6d28d9',         -- hex for chip badge
  notes text,                               -- admin note about why
  created_at timestamptz default now(),
  created_by_email text,
  unique (tenant_id, customer_email, tag_name)
);

create index customer_tags_email_idx on customer_tags (tenant_id, lower(customer_email));
create index customer_tags_name_idx on customer_tags (tenant_id, tag_name);

alter table customer_tags enable row level security;
create policy "service_role_full_access" on customer_tags
  for all using (auth.role() = 'service_role');
create policy "tenant_members_full" on customer_tags
  for all using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );

-- ── Campaigns ──
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,                        -- markdown / plain text with {firstName} etc.
  filter_json jsonb not null default '{}'::jsonb,
    -- shape:
    --   { "tags": ["promoter","vip"],           // OR-match
    --     "booked_within_days": 90,             // last paid booking within N days
    --     "min_total_spent_cents": 0,
    --     "all_customers": false }
  recipient_count int default 0,             -- snapshot of audience size at send time
  sent_count int default 0,
  failed_count int default 0,
  status text default 'draft',               -- 'draft' | 'sending' | 'sent' | 'failed'
  sent_at timestamptz,
  created_at timestamptz default now(),
  created_by_email text
);

create index campaigns_tenant_idx on campaigns (tenant_id, created_at desc);

alter table campaigns enable row level security;
create policy "service_role_full_access" on campaigns
  for all using (auth.role() = 'service_role');
create policy "tenant_members_full" on campaigns
  for all using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );

-- Per-recipient log so we know who got what + can re-send failures later
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  customer_email text not null,
  first_name text,
  succeeded boolean default false,
  resend_id text,
  error_message text,
  sent_at timestamptz default now()
);

create index campaign_recipients_campaign_idx on campaign_recipients (campaign_id, succeeded);

alter table campaign_recipients enable row level security;
create policy "service_role_full_access" on campaign_recipients
  for all using (auth.role() = 'service_role');
