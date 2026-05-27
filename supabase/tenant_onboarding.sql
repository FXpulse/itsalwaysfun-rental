-- ─────────────────────────────────────────────────────────────────────────
-- TENANT ONBOARDING TRACKING
-- ─────────────────────────────────────────────────────────────────────────
-- Adds onboarding_completed_at to the tenants table. When NULL, the admin
-- layout redirects the tenant's admin to /admin/onboarding (a 4-step
-- wizard: business info → logo → first product → Stripe connect).
--
-- Existing tenants (IAF, testbouncers, etc.) are marked completed so they
-- skip the wizard — only brand-new signups go through it.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.tenants
  add column if not exists onboarding_completed_at timestamptz;

-- Backfill: any tenant created BEFORE this migration already has data,
-- skip the wizard for them.
update public.tenants
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null;

notify pgrst, 'reload schema';
