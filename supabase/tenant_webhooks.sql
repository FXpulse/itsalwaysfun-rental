-- supabase/tenant_webhooks.sql
--
-- Tenants subscribe to events (booking.created, booking.cancelled,
-- customer.created, etc.) by registering a webhook URL. When the event
-- fires we POST the payload to their URL with an HMAC signature.

create table if not exists public.tenant_webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,                    -- "Zapier", "My CRM sync"
  url text not null,
  events text[] not null default '{}',   -- ['booking.created', 'customer.created']
  secret text not null,                  -- random string used for HMAC sig
  is_active boolean default true,
  last_delivery_at timestamptz,
  last_delivery_status int,              -- HTTP status of last attempt
  total_deliveries int default 0,
  failed_deliveries int default 0,
  created_at timestamptz default now(),
  created_by_email text
);

create index tenant_webhooks_tenant_idx on tenant_webhooks (tenant_id, is_active);
create index tenant_webhooks_events_idx on tenant_webhooks using gin (events);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references tenant_webhooks(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  response_status int,
  response_body text,
  attempt_count int default 1,
  succeeded boolean default false,
  created_at timestamptz default now()
);

create index webhook_deliveries_webhook_idx on webhook_deliveries (webhook_id, created_at desc);

alter table tenant_webhooks enable row level security;
alter table webhook_deliveries enable row level security;

create policy "service_role_full_access" on tenant_webhooks
  for all using (auth.role() = 'service_role');
create policy "service_role_full_access" on webhook_deliveries
  for all using (auth.role() = 'service_role');

create policy "tenant_members_read" on tenant_webhooks
  for select using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );
