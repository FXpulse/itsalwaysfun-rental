-- Add tags column to lead_magnet_signups so we keep the segmentation info that
-- previously only existed in GHL. After decoupling from GHL (2026-06-18),
-- lead_magnet.ts builds the tags array and stores it on the row directly.
--
-- The ghl_synced_at and ghl_contact_id columns stay for historical rows; the
-- column is harmless if NULL going forward.

ALTER TABLE lead_magnet_signups
  ADD COLUMN IF NOT EXISTS tags text[];

CREATE INDEX IF NOT EXISTS idx_lead_magnet_signups_tags
  ON lead_magnet_signups USING GIN (tags);
