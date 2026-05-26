-- Starter packages for It's Always Fun.
-- 8 ready-to-go bundles with names, descriptions, suggested prices, and
-- placeholder image URLs from Unsplash (CC0 stock photos for the categories).
-- After running this:
--   1. Edit each package in /admin/packages to attach real products from your inventory
--   2. Replace the Unsplash images with custom AI-generated ones (see
--      docs/package-image-prompts.md for prompts you can paste into Claude/DALL-E)
--
-- Idempotent: safe to re-run, won't duplicate (uses slug as unique key).
-- All packages start INACTIVE so they don't show publicly until you finish setup.

insert into public.packages (slug, name, description, image_url, price_cents, items, display_order, is_active) values
(
  'birthday-classic',
  'Birthday Party Classic',
  '4-hour bounce house rental + 1 table + 6 folding chairs. Perfect for backyard birthdays with up to 15 kids. Cleaned & sanitized, free Jacksonville delivery.',
  'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
  29900,  -- $299
  '[]'::jsonb,
  10,
  false
),
(
  'birthday-premium',
  'Birthday Bash Premium',
  'Bouncer + slide combo + 2 tables + 12 chairs + cotton candy machine (50 servings). The "wow" package for memorable parties — kids talk about it for weeks.',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80',
  54900,  -- $549
  '[]'::jsonb,
  20,
  false
),
(
  'toddler-safe',
  'Tiny Tots Special',
  'Smaller bounce house designed for ages 2-5 with shorter walls + softer landing. Includes 1 table + 4 small chairs. Safe, supervised play for the little ones.',
  'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800&q=80',
  19900,  -- $199
  '[]'::jsonb,
  30,
  false
),
(
  'splash-summer',
  'Splash Day Special',
  'Water slide + wet bouncer + cooler stocked with ice. Perfect for hot Jacksonville summers — keeps everyone cool. Requires hose connection at venue.',
  'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&q=80',
  44900,  -- $449
  '[]'::jsonb,
  40,
  false
),
(
  'backyard-bash',
  'Backyard Bash',
  'Large bounce house + dry slide + power supply included. Built for big backyards and bigger fun. Ages 5-12 favorite combo.',
  'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
  39900,  -- $399
  '[]'::jsonb,
  50,
  false
),
(
  'family-reunion',
  'Family Reunion XL',
  'Large combo unit + 4 tables + 24 chairs + 2 concessions (popcorn + snow cones, ~75 servings each). All-day rental option available.',
  'https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=800&q=80',
  84900,  -- $849
  '[]'::jsonb,
  60,
  false
),
(
  'corporate-event',
  'Corporate / Community Event',
  '2 large bouncers + 1 dry slide + COI (Certificate of Insurance) included free + 6 tables + 30 chairs. Pre-approved for schools, parks, HOAs.',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=800&q=80',
  124900,  -- $1,249
  '[]'::jsonb,
  70,
  false
),
(
  'princess-tea-party',
  'Princess Tea Party',
  'Princess-themed bounce castle + tea party setup (1 round table + 6 small chairs with white linens). Magical setup that kids 4-9 adore.',
  'https://images.unsplash.com/photo-1572188651711-d0c0a73a8e1f?w=800&q=80',
  34900,  -- $349
  '[]'::jsonb,
  80,
  false
)
on conflict (slug) do nothing;

-- Note: items array is empty by default. After running this SQL:
-- 1. Go to /admin/products and confirm you have your real products created
-- 2. Open each package at /admin/packages/[id] and add the products from your inventory
--    via the "Items in bundle" section
-- 3. Once items are added + you're happy with the price → toggle is_active=true
