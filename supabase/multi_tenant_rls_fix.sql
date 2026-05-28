-- Fix the original RLS migration's broken table references + add missing
-- tables. The original (supabase/multi_tenant_rls.sql) used names that don't
-- exist: 'reviews' (actual: customer_reviews) and 'audit_log' (actual:
-- admin_audit_log). PostgreSQL's to_regclass() check silently skipped them
-- so neither had RLS. Several other tables were also missing.
--
-- This file uses explicit ALTER + CREATE POLICY per table — verbose but
-- unambiguous (no nested dollar-quoting that some SQL editors mishandle).
-- Idempotent: drop policy if exists; create policy.

-- ─── customer_reviews ───────────────────────────────────────────────
alter table public.customer_reviews enable row level security;
drop policy if exists tenant_isolation on public.customer_reviews;
create policy tenant_isolation on public.customer_reviews
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── admin_audit_log ────────────────────────────────────────────────
alter table public.admin_audit_log enable row level security;
drop policy if exists tenant_isolation on public.admin_audit_log;
create policy tenant_isolation on public.admin_audit_log
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── gift_card_purchases ────────────────────────────────────────────
alter table public.gift_card_purchases enable row level security;
drop policy if exists tenant_isolation on public.gift_card_purchases;
create policy tenant_isolation on public.gift_card_purchases
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── gift_card_redemptions ──────────────────────────────────────────
alter table public.gift_card_redemptions enable row level security;
drop policy if exists tenant_isolation on public.gift_card_redemptions;
create policy tenant_isolation on public.gift_card_redemptions
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── loyalty_transactions ───────────────────────────────────────────
alter table public.loyalty_transactions enable row level security;
drop policy if exists tenant_isolation on public.loyalty_transactions;
create policy tenant_isolation on public.loyalty_transactions
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── contact_message_replies ────────────────────────────────────────
alter table public.contact_message_replies enable row level security;
drop policy if exists tenant_isolation on public.contact_message_replies;
create policy tenant_isolation on public.contact_message_replies
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── setup_surfaces ─────────────────────────────────────────────────
alter table public.setup_surfaces enable row level security;
drop policy if exists tenant_isolation on public.setup_surfaces;
create policy tenant_isolation on public.setup_surfaces
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── booking_waivers ────────────────────────────────────────────────
alter table public.booking_waivers enable row level security;
drop policy if exists tenant_isolation on public.booking_waivers;
create policy tenant_isolation on public.booking_waivers
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── booking_extensions ─────────────────────────────────────────────
alter table public.booking_extensions enable row level security;
drop policy if exists tenant_isolation on public.booking_extensions;
create policy tenant_isolation on public.booking_extensions
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── booking_proofs ─────────────────────────────────────────────────
alter table public.booking_proofs enable row level security;
drop policy if exists tenant_isolation on public.booking_proofs;
create policy tenant_isolation on public.booking_proofs
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));

-- ─── booking_damages ────────────────────────────────────────────────
alter table public.booking_damages enable row level security;
drop policy if exists tenant_isolation on public.booking_damages;
create policy tenant_isolation on public.booking_damages
  as restrictive for all to authenticated, anon
  using (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.headers', true)::json->>'x-tenant-id', ''));
