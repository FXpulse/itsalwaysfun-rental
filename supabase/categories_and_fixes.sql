-- =====================================================
-- Categories table + product re-categorization + clear broken images
-- =====================================================

-- 1. Categories table
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  description   TEXT,
  image_url     TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_active_categories ON categories;
CREATE POLICY public_read_active_categories
  ON categories FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS service_role_all_categories ON categories;
CREATE POLICY service_role_all_categories
  ON categories FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION bump_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION bump_categories_updated_at();

-- 2. Seed (idempotent — ON CONFLICT DO NOTHING)
INSERT INTO categories (name, slug, description, display_order, is_active) VALUES
  ('Bounce Houses',           'bounce-houses', 'Themed bounce houses for every party.',         1, TRUE),
  ('Bounce & Slide Combos',   'combos',        'Bounce house + slide built into one unit.',     2, TRUE),
  ('Dry Slides',              'dry-slides',    'Big slides for big thrills.',                   3, TRUE),
  ('Concessions',             'concessions',   'Snow cones, cotton candy, popcorn and more.',   4, FALSE),
  ('Add-Ons',                 'add-ons',       'Tables, chairs, generators and other extras.',  5, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- 3. Re-categorize products that are actually combos
UPDATE products SET category = 'Bounce & Slide Combos'
WHERE slug IN ('block-party', 'fire-fighter-station');

-- 4. Clear known-broken image URLs (sysers.com 404s)
-- Once admin uploads new ones via /admin/products/[id], image_url is repopulated
UPDATE products SET image_url = NULL
WHERE slug IN (
  'carnival-kingdom',
  'ninja-bounce-academy',
  'robo-jump',
  'tea-party-time',
  'the-web-zone',
  'unicorn-dreamland',
  'fire-fighter-station',
  'block-party',
  'sunny-smiles-slide',
  'turbo-desert-dash'
);

-- 5. Verify
SELECT slug, name, category, CASE WHEN image_url IS NULL THEN '(none — upload one)' ELSE 'image set' END AS image_status
FROM products
ORDER BY category, name;

SELECT name, slug, is_active, display_order FROM categories ORDER BY display_order;
