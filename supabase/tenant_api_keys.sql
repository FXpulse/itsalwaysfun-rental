-- supabase/tenant_api_keys.sql
--
-- Tenants generate API keys to integrate RentalFlow with Zapier, Make,
-- their own back-office, etc. Keys are shown ONCE at creation, then we
-- store only the sha256 hash + a short prefix for identification.
--
-- Format: rfk_<32 base64url chars>
-- Display: rfk_abc1...xyz9 (first 8 + last 4)

create table if not exists public.tenant_api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,                       -- "Zapier integration", "My back-office"
  key_hash text not null unique,            -- sha256 of full token
  key_prefix text not null,                 -- "rfk_abc12345" — first 12 chars, shown in UI
  scopes text[] not null default '{}',      -- e.g. {bookings:read, customers:read}
  last_used_at timestamptz,
  last_used_ip text,
  expires_at timestamptz,                   -- null = never
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz default now(),
  created_by_email text
);

create index tenant_api_keys_tenant_idx on tenant_api_keys (tenant_id, created_at desc);
create index tenant_api_keys_hash_idx on tenant_api_keys (key_hash) where revoked_at is null;

alter table tenant_api_keys enable row level security;

create policy "service_role_full_access" on tenant_api_keys
  for all using (auth.role() = 'service_role');

-- Tenant members can see their own keys
create policy "tenant_members_read" on tenant_api_keys
  for select using (
    tenant_id in (
      select tenant_id from user_roles
      where user_id = auth.uid() and is_active = true
    )
  );
