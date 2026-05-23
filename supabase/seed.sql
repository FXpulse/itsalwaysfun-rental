-- =====================================================
-- It's Always Fun, LLC — Seed Data (14 products)
-- =====================================================
-- Run AFTER schema.sql in Supabase SQL Editor.
-- =====================================================

INSERT INTO products (name, slug, category, price_per_day, stock, description, age_group, is_active) VALUES
  ('All-Star Sports Arena', 'all-star-sports-arena', 'Bounce Houses', 29900, 1, 'Sports-themed bounce house with basketball hoop and obstacle elements. Great for sports parties.', 'All ages', TRUE),
  ('Carnival Kingdom', 'carnival-kingdom', 'Bounce Houses', 44900, 1, 'Premium carnival-themed inflatable with multiple play zones. Vibrant colors, fun for big groups.', 'All ages', TRUE),
  ('Dig & Dash Dozer', 'dig-dash-dozer', 'Bounce Houses', 34900, 1, 'Construction-themed bounce house featuring bulldozers and digging gear. Perfect for builder-themed parties.', 'All ages', TRUE),
  ('Game On', 'game-on', 'Bounce Houses', 34900, 1, 'Sports/video game themed bounce house. Energetic design loved by kids and tweens.', 'All ages', TRUE),
  ('Mega Monster Jump', 'mega-monster-jump', 'Bounce Houses', 34900, 1, 'Monster-themed bouncer with bold graphics. Big jumping area for active kids.', 'All ages', TRUE),
  ('Ninja Bounce Academy', 'ninja-bounce-academy', 'Bounce Houses', 29900, 1, 'Ninja warrior themed bouncer with mini-obstacles. Perfect for action-oriented parties.', 'All ages', TRUE),
  ('Robo Jump', 'robo-jump', 'Bounce Houses', 34900, 1, 'Robot/sci-fi themed bounce house. Futuristic graphics, great for tech-themed events.', 'All ages', TRUE),
  ('Tea Party Time', 'tea-party-time', 'Bounce Houses', 34900, 1, 'Princess/tea-party themed inflatable. Elegant design popular for girl birthday parties.', 'All ages', TRUE),
  ('The Web Zone', 'the-web-zone', 'Bounce Houses', 29900, 1, 'Spider/superhero themed bouncer with web graphics. Great for action-hero themed parties.', 'All ages', TRUE),
  ('Unicorn Dreamland', 'unicorn-dreamland', 'Bounce Houses', 29900, 1, 'Magical unicorn-themed bouncer with rainbow colors. Fan favorite for kid parties.', 'All ages', TRUE),
  ('Fire Fighter Station', 'fire-fighter-station', 'Bounce Houses', 44900, 1, 'Firefighter-themed premium inflatable. Educational and fun, ideal for community events.', 'All ages', TRUE),
  ('Block Party', 'block-party', 'Bounce Houses', 44900, 1, 'Multi-color block-themed premium bounce house. Bright and energetic for big gatherings.', 'All ages', TRUE),
  ('Sunny Smiles Slide', 'sunny-smiles-slide', 'Dry Slides', 44900, 1, 'Tall dry slide with sunny graphics. Safe and exciting for kids and adults.', 'All ages', TRUE),
  ('Turbo Desert Dash', 'turbo-desert-dash', 'Dry Slides', 44900, 1, 'Desert-themed racing dry slide with dual lanes for friendly competition.', 'All ages', TRUE);

-- Verify
SELECT slug, name, category, price_per_day, stock FROM products ORDER BY category, name;
