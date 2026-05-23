-- =====================================================
-- Add payment_method column to track HOW a booking was paid
-- =====================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method TEXT
  DEFAULT 'stripe'
  CHECK (payment_method IN ('stripe','cash','venmo','zelle','check','other','none'));

-- Existing bookings: set to 'none' if pending, 'stripe' if has intent ID, else 'other'
UPDATE bookings
SET payment_method = CASE
  WHEN stripe_payment_intent_id IS NOT NULL THEN 'stripe'
  WHEN stripe_payment_status = 'pending' THEN 'none'
  ELSE 'other'
END
WHERE payment_method IS NULL OR payment_method = 'stripe';

-- Verify
SELECT booking_status, stripe_payment_status, payment_method, COUNT(*)
FROM bookings GROUP BY booking_status, stripe_payment_status, payment_method
ORDER BY booking_status;
