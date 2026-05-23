-- =====================================================
-- Coupons system
-- =====================================================
-- discount_type:
--   'percent' → discount_value is 0-100 (percentage off)
--   'fixed'   → discount_value is cents (flat amount off)
-- max_uses: null = unlimited
-- expires_at: null = never expires
-- =====================================================

CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  description     TEXT,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value  INTEGER NOT NULL CHECK (discount_value >= 0),
  max_uses        INTEGER,
  current_uses    INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_coupons ON coupons;
CREATE POLICY service_role_all_coupons
  ON coupons FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
-- No public SELECT — validate via API to avoid leaking all codes

CREATE OR REPLACE FUNCTION bump_coupons_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coupons_updated_at ON coupons;
CREATE TRIGGER coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION bump_coupons_updated_at();

-- Track which booking used which coupon
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0;

-- Sample seed (you can edit/delete from admin)
INSERT INTO coupons (code, description, discount_type, discount_value, is_active) VALUES
  ('WELCOME10', '10% off first rental', 'percent', 10, TRUE),
  ('SUMMER25', '$25 off — summer promo', 'fixed', 2500, TRUE)
ON CONFLICT (code) DO NOTHING;

SELECT code, description, discount_type, discount_value, is_active FROM coupons;
