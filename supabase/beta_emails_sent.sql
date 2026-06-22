-- supabase/beta_emails_sent.sql
--
-- Idempotency ledger for the beta-program lifecycle emails. Each tenant
-- gets each email at most once. Mirrors the existing onboarding_nudges_sent
-- pattern on the same table.
--
-- Email keys (string entries in the array):
--   'welcome'        — fires from signup action immediately
--   'day_20_checkin' — fires from /api/cron/beta-lifecycle when days_since_joined >= 20
--   'day_40_usage'   — fires when days_since_joined >= 40
--   'day_50_convert' — fires when days_since_joined >= 50

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS beta_emails_sent jsonb DEFAULT '[]'::jsonb NOT NULL;
