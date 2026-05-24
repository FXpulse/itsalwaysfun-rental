-- Per-zone appearance settings (background color, text color, font family).
-- Empty value = use default styling.
--
-- Zones on the home page:
--   hero        → top hero banner
--   categories  → category cards section
--   featured    → featured products section
--   trust       → trust strip (delivery / cleaned / rating)
--   footer      → site footer

insert into public.site_settings (key, value, description, category) values
  -- HERO
  ('hero_bg_color', '', 'Hero background color (leave blank for default navy gradient). Try #1a1a6e or #000', 'appearance'),
  ('hero_text_color', '', 'Hero text color (default: white)', 'appearance'),
  ('hero_font_family', '', 'Hero font family (default: system)', 'appearance'),

  -- CATEGORIES
  ('categories_bg_color', '', 'Categories section background (default: white)', 'appearance'),
  ('categories_text_color', '', 'Categories text color (default: navy)', 'appearance'),
  ('categories_font_family', '', 'Categories font family', 'appearance'),

  -- FEATURED
  ('featured_bg_color', '', 'Featured products section background (default: slate-50)', 'appearance'),
  ('featured_text_color', '', 'Featured products text color', 'appearance'),
  ('featured_font_family', '', 'Featured products font family', 'appearance'),

  -- TRUST STRIP
  ('trust_bg_color', '', 'Trust strip background (default: brand yellow)', 'appearance'),
  ('trust_text_color', '', 'Trust strip text color (default: navy)', 'appearance'),
  ('trust_font_family', '', 'Trust strip font family', 'appearance'),

  -- FOOTER
  ('footer_bg_color', '', 'Footer background color (default: navy)', 'appearance'),
  ('footer_text_color', '', 'Footer text color (default: white)', 'appearance'),
  ('footer_font_family', '', 'Footer font family', 'appearance')
on conflict (key) do nothing;
