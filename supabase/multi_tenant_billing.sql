-- ─────────────────────────────────────────────────────────────────────────
-- MULTI-TENANT PHASE 4 — Tenant billing (Stripe Subscriptions)
-- ─────────────────────────────────────────────────────────────────────────
-- Adds the columns RentalFlow needs to charge tenants their monthly
-- subscription. Separate from the tenant's OWN Stripe Connect account
-- (which receives THEIR customers' payments).
--
-- - stripe_customer_id: tenant's Stripe Customer in OUR platform Stripe
-- - stripe_subscription_id: the active subscription on our platform
-- - subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled'
--                       | 'incomplete' (mirrors Stripe lifecycle)
-- - current_period_end: when this billing cycle expires
-- - cancel_at_period_end: tenant requested cancellation (still active)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text
    check (subscription_status is null or subscription_status in
      ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')),
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists tenants_subscription_status_idx
  on public.tenants(subscription_status);
create index if not exists tenants_stripe_customer_idx
  on public.tenants(stripe_customer_id) where stripe_customer_id is not null;

-- Initial state: founder plan (Ludmila's IAF) → mark as forever-active
update public.tenants
set subscription_status = 'active'
where plan = 'founder' and subscription_status is null;

notify pgrst, 'reload schema';
