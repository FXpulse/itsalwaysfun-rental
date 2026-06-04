-- Twilio toll-free verification compliance: persist proof of SMS opt-in
-- collected at checkout. Required by Twilio to re-submit toll-free
-- verification after rejection for "Opt-in not sufficient: Language Unclear".
--
-- When the customer ticks the SMS consent checkbox in the booking flow,
-- the server stamps this column with the consent timestamp. Twilio audits
-- show the URL of the booking flow + the consent language + per-booking
-- timestamps as proof.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_phone_sms_consent_at timestamptz;

-- Also stamp on customer record so future bookings inherit the opt-in
-- (no need to re-consent every time the same customer rebooks).
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz;
