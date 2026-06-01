-- supabase/portal_otp_codes.sql
--
-- Stores short-lived 6-digit codes for customer portal magic-link
-- replacement. We bypass Supabase email entirely — backend generates the
-- code, sends via Resend (full template control), and verifies server-side.
--
-- Lifecycle: insert on request → expires in 15 min → deleted on use OR on
-- next request from same email (single active code per email).

create table if not exists public.portal_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tenant_id uuid references tenants(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index portal_otp_email_idx on portal_otp_codes (email, created_at desc);
create index portal_otp_expires_idx on portal_otp_codes (expires_at) where consumed_at is null;

alter table portal_otp_codes enable row level security;

create policy "service_role_full_access" on portal_otp_codes
  for all using (auth.role() = 'service_role');
