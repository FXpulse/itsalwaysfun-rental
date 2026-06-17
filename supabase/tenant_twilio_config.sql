-- supabase/tenant_twilio_config.sql
--
-- Per-tenant Twilio from-number (shared-account model).
--
-- The PLATFORM owns one Twilio account (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
-- in env). Each tenant gets their OWN phone number purchased inside that
-- account. The number is stored on the tenants row and used as the `From`
-- field when sending SMS for that tenant's customers.
--
-- Without twilio_from_number set, the tenant's SMS sends are SKIPPED for
-- customer-facing flows (booking confirmation, reminders, etc.) — Sentry
-- logs an info breadcrumb, the email side still goes out. Platform-side
-- SMS (if any are ever added) keep using the TWILIO_FROM_NUMBER env value.
--
-- Migration plan:
--   1. Apply this migration
--   2. Buy 1 Twilio number per tenant in the Twilio console
--   3. Paste the E.164 number into /superadmin/tenants/[id]/sms
--   4. (Optional) Register a Messaging Service if you want to consolidate
--      A2P 10DLC across multiple numbers — store its SID in
--      twilio_messaging_service_sid and Twilio will pick the right number
--      automatically per destination.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS twilio_from_number text,
  ADD COLUMN IF NOT EXISTS twilio_messaging_service_sid text;

-- E.164 sanity check at write time (single + sign, then 10-15 digits).
-- Permissive on purpose — the UI does stricter validation with Zod.
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_twilio_from_number_e164_chk;
ALTER TABLE tenants
  ADD CONSTRAINT tenants_twilio_from_number_e164_chk
  CHECK (twilio_from_number IS NULL OR twilio_from_number ~ '^\+[1-9][0-9]{9,14}$');
