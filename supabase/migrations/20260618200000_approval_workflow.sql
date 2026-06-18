-- Approval workflow for high-ticket bookings (added 2026-06-18).
--
-- Tenants can set an approval threshold in dollars. Customer-side bookings
-- whose total exceeds the threshold land in approval_status='pending'
-- instead of going straight to 'confirmed'. An admin must approve or reject
-- before the customer sees the confirmation email + dispatch is built.
--
-- NULL threshold = approval disabled for that tenant (default — backward compat).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS approval_threshold_cents int;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_by text,
  ADD COLUMN IF NOT EXISTS approval_notes text;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_approval_status_chk;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_approval_status_chk
  CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'));

-- Index for the admin's "pending approval" filter query
CREATE INDEX IF NOT EXISTS idx_bookings_approval_pending
  ON bookings (tenant_id, approval_requested_at DESC)
  WHERE approval_status = 'pending';
