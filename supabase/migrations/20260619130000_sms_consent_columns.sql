-- Twilio toll-free verification compliance: persist proof of SMS opt-in
-- collected at checkout. The original supabase/sms_consent_audit.sql
-- standalone file never made it into a proper migration, so the column
-- is missing on the live DB and any booking insert that sets it (quote
-- accept flow, /order-by-date wizard) fails with "could not find column
-- 'customer_phone_sms_consent_at' of 'bookings' in the schema cache".
--
-- Idempotent (ADD COLUMN IF NOT EXISTS).
--
-- NOTE: The old sms_consent_audit.sql also altered a "customers" table
-- which doesn't exist on prod (this project uses customer_profiles).
-- Only the bookings column is actually referenced from app code.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_phone_sms_consent_at timestamptz;
