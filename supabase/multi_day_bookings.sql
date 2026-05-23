-- =====================================================
-- Multi-day bookings — add event_end_date column
-- =====================================================
-- event_date = first day (start)
-- event_end_date = last day (end) — NULL means single-day (use event_date)
-- total_amount = price_per_day × number of days (admin can override)
-- =====================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_end_date DATE;

-- Backfill: single-day bookings have end_date = event_date
UPDATE bookings SET event_end_date = event_date WHERE event_end_date IS NULL;

-- New constraint: end date >= start date
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_end_after_start;
ALTER TABLE bookings ADD CONSTRAINT bookings_end_after_start
  CHECK (event_end_date IS NULL OR event_end_date >= event_date);

-- Index for range queries
CREATE INDEX IF NOT EXISTS idx_bookings_date_range
  ON bookings(product_id, event_date, event_end_date);

-- Verify
SELECT event_date, event_end_date, total_amount, booking_status
FROM bookings
ORDER BY event_date
LIMIT 10;
