-- =====================================================
-- Storage bucket + Site Settings table
-- Run in Supabase SQL Editor.
-- =====================================================

-- ── 1. Storage buckets ───────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,                            -- public read
  5 * 1024 * 1024,                 -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  TRUE,
  5 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/jpg'];

-- ── 2. Public read for bucket objects ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_product_images'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY public_read_product_images
        ON storage.objects FOR SELECT
        USING (bucket_id = 'product-images')
    $POLICY$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_read_site_assets'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY public_read_site_assets
        ON storage.objects FOR SELECT
        USING (bucket_id = 'site-assets')
    $POLICY$;
  END IF;
END $$;

-- (Service role can do everything by default, no policy needed.)

-- ── 3. site_settings table ────────────────────────────
DROP TABLE IF EXISTS site_settings CASCADE;

CREATE TABLE site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

CREATE INDEX idx_site_settings_category ON site_settings(category);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_site_settings
  ON site_settings FOR SELECT USING (TRUE);

CREATE POLICY service_role_all_site_settings
  ON site_settings FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Trigger to bump updated_at
CREATE OR REPLACE FUNCTION bump_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION bump_site_settings_updated_at();

-- ── 4. Seed default values ────────────────────────────
INSERT INTO site_settings (key, value, description, category) VALUES
  -- Business info
  ('business_name', 'It''s Always Fun, LLC', 'Company name shown in header + footer', 'business'),
  ('business_phone', '(904) 584-3047', 'Primary phone — header, footer, contact', 'business'),
  ('business_email', 'admin@itsalwaysfun.com', 'Contact + footer email', 'business'),
  ('business_address', '8917 Western Way, Jacksonville, FL 32256', 'Physical address — footer', 'business'),
  ('business_hours', '8:00 AM – 6:00 PM ET, Monday-Saturday', 'Operating hours — contact page', 'business'),
  ('service_area', 'Jacksonville, FL and surrounding areas within 30 miles', 'Where you deliver', 'business'),

  -- Social
  ('instagram_url', 'https://instagram.com/itsalwaysfunparty', 'Instagram profile URL', 'social'),
  ('facebook_url', 'https://facebook.com/itsalwaysfunparty', 'Facebook page URL', 'social'),

  -- Branding
  ('logo_url', 'https://files.sysers.com/cp/upload/itsalwaysfun/editor/med/its_always_fun_logo.png', 'Logo image URL — upload from admin', 'branding'),

  -- Homepage hero
  ('hero_title', 'Welcome to It''s Always Fun', 'Main heading on home page', 'home'),
  ('hero_subtitle', 'We don''t just rent bounce houses — we create unforgettable memories filled with energy, laughter, and joy.', 'Sub-heading under hero', 'home'),
  ('hero_tagline', 'Because when it comes to your special day, fun isn''t optional, it''s guaranteed!', 'Yellow tagline below subtitle', 'home'),
  ('hero_cta_label', 'Check availability →', 'Hero button text', 'home'),

  -- Homepage sections
  ('section_categories_title', 'Bounce Higher. Laugh Louder. Celebrate Bigger.', 'Title above category grid', 'home'),
  ('section_featured_title', 'Our Rentals', 'Title above featured products', 'home'),

  -- Trust strip
  ('trust_delivery', 'Free Delivery — Within Jacksonville metro area', 'Trust line 1', 'home'),
  ('trust_cleaned', 'Cleaned & Sanitized — Every unit, every rental, every time', 'Trust line 2', 'home'),
  ('trust_rating', '5-Star Rated — Hundreds of happy families', 'Trust line 3', 'home'),

  -- Footer
  ('footer_description', 'We don''t just rent bounce houses — we create unforgettable memories filled with energy, laughter, and joy. Serving Jacksonville and surrounding areas.', 'Footer brand description', 'footer'),

  -- Misc
  ('booking_terms_note', 'Reschedule up to 7 days before with no fee.', 'Booking terms summary', 'business')
ON CONFLICT (key) DO NOTHING;

-- ── Verify ────────────────────────────────────────────
SELECT category, COUNT(*) FROM site_settings GROUP BY category ORDER BY category;
SELECT key, LEFT(value, 60) AS preview FROM site_settings ORDER BY category, key;
