-- supabase/tenant_ghl_config.sql
--
-- Per-tenant GoHighLevel sub-account config (agency model).
--
-- The PLATFORM owns one master GHL agency account. Each tenant gets their
-- own sub-account (Location) under that agency. The API key (PIT) stays
-- platform-side in GHL_API_KEY env, but the Location ID + workflow webhook
-- URLs are per-tenant.
--
-- Without these set, tenant's bookings/contacts/abandoned-carts do NOT
-- push to any GHL — Sentry logs a warning, primary operation succeeds.
--
-- Migration of IAF's existing env values to its tenant row is done as
-- a one-shot UPDATE below. Run AFTER applying this migration.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS ghl_location_id text,
  ADD COLUMN IF NOT EXISTS ghl_booking_webhook_url text,
  ADD COLUMN IF NOT EXISTS ghl_abandoned_cart_webhook_url text,
  ADD COLUMN IF NOT EXISTS ghl_referral_webhook_url text,
  ADD COLUMN IF NOT EXISTS ghl_quote_webhook_url text;

-- Backfill IAF (the original tenant) with the env values that are currently
-- doing duty as "the GHL config for the whole system". After this UPDATE
-- the env vars become deprecated fallbacks that should be removed once
-- every tenant row is configured.
-- Note: env values must be passed in via the application, not the SQL —
-- so this UPDATE is a no-op here. Application has a one-shot endpoint
-- /api/admin/migrate-iaf-ghl that reads env and writes to the IAF row.
-- (Or: Ludmila just copies/pastes via /superadmin/tenants/[iaf-id] UI.)

-- Helpful index for the lookup that runs on every Stripe webhook
CREATE INDEX IF NOT EXISTS idx_tenants_ghl_location_id
  ON tenants (ghl_location_id) WHERE ghl_location_id IS NOT NULL;
