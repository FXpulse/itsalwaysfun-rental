-- ─────────────────────────────────────────────────────────────────────────
-- DEMO SEED — testbouncers tenant
-- ─────────────────────────────────────────────────────────────────────────
-- Populates the testbouncers.getrentalflow.com tenant with realistic
-- demo content so prospects visiting the live demo see a fully-stocked
-- bounce house rental site (products, categories, packages, settings).
--
-- Run AFTER signup of testbouncers tenant. Idempotent (uses
-- ON CONFLICT DO NOTHING per row).
--
-- Resolves tenant by slug = 'testbouncers'. If the tenant doesn't exist,
-- raises a notice and exits cleanly.
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  t_id uuid;
  cat_bouncers_id uuid;
  cat_combos_id uuid;
  cat_waterslides_id uuid;
  cat_addons_id uuid;
begin
  -- 1. Find the tenant
  select id into t_id from public.tenants where slug = 'testbouncers';
  if t_id is null then
    raise notice '⚠ testbouncers tenant not found — sign up at getrentalflow.com/signup first';
    return;
  end if;

  raise notice '✓ seeding tenant %', t_id;

  -- 2. Update business info / branding
  update public.tenants
  set
    business_name = 'Test Bouncers Party Rentals',
    branding = jsonb_build_object(
      'primary_color', '#7c3aed',  -- purple, distinct from IAF navy
      'accent_color', '#fbbf24',   -- amber
      'font_family', 'Quicksand',
      'logo_url', ''
    )
  where id = t_id;

  -- 3. Site settings
  insert into public.site_settings (tenant_id, key, value, description, category) values
    (t_id, 'business_name', 'Test Bouncers Party Rentals', 'Public business name', 'general'),
    (t_id, 'business_phone', '+1 (555) 123-4567', 'Phone shown in footer', 'general'),
    (t_id, 'business_address', '123 Demo St, Tampa, FL 33602', 'Address', 'general'),
    (t_id, 'business_email', 'hello@testbouncers.com', 'Contact email', 'general'),
    (t_id, 'hero_headline', 'Bounce houses, water slides, and party rentals — delivered!', 'Homepage hero', 'content'),
    (t_id, 'hero_subheadline', 'Serving Tampa Bay since this is a demo. Book online, we deliver, you party.', 'Homepage hero', 'content'),
    (t_id, 'min_booking_lead_hours', '48', 'Minimum lead time in hours', 'booking'),
    (t_id, 'damage_protection_enabled', 'true', 'Show damage protection at checkout', 'booking'),
    (t_id, 'damage_protection_price_cents', '2500', 'Damage protection fee', 'booking'),
    (t_id, 'damage_protection_coverage_cents', '50000', 'Damage protection coverage', 'booking'),
    (t_id, 'waiver_enabled', 'true', 'Require waiver at checkout', 'legal'),
    (t_id, 'coi_request_enabled', 'true', 'COI request option at checkout', 'legal'),
    (t_id, 'packages_section_enabled', 'true', 'Show packages on public site', 'sections'),
    (t_id, 'google_review_url', 'https://maps.app.goo.gl/example', 'Google reviews link', 'reviews')
  on conflict (tenant_id, key) do nothing;

  -- 4. Categories
  insert into public.categories (tenant_id, name, slug, display_order, is_active)
  values
    (t_id, 'Bouncers', 'bouncers', 1, true),
    (t_id, 'Combos', 'combos', 2, true),
    (t_id, 'Water Slides', 'water-slides', 3, true),
    (t_id, 'Add-ons', 'addons', 99, true)
  on conflict (tenant_id, slug) do nothing;

  select id into cat_bouncers_id from public.categories where tenant_id = t_id and slug = 'bouncers';
  select id into cat_combos_id from public.categories where tenant_id = t_id and slug = 'combos';
  select id into cat_waterslides_id from public.categories where tenant_id = t_id and slug = 'water-slides';
  select id into cat_addons_id from public.categories where tenant_id = t_id and slug = 'addons';

  -- 5. Products — rentable items
  insert into public.products
    (tenant_id, name, slug, category, description, price_per_day, weekend_price_per_day, image_url, stock, is_active, is_addon, setup_area, actual_size, age_group, cost_cents)
  values
    -- Bouncers
    (t_id, 'Castle Bouncer 13x13', 'castle-bouncer-13x13',
     'bouncers', 'Classic medieval castle bouncer with a tall turret and large jumping area. Perfect for ages 3-12. Setup needs 17x17 of flat space + 3 ft for blower.',
     14900, 17900, 'https://images.unsplash.com/photo-1602536052359-ef94c21c5948?w=800', 3, true, false, '17x17 ft', '13x13x13 ft', 'Ages 3-12', 80000),

    (t_id, 'Princess Palace 15x15', 'princess-palace-15x15',
     'bouncers', 'Pink and white princess castle with crown accents. Big windows so parents can see kids playing inside. Quiet blower included.',
     17900, 19900, 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800', 2, true, false, '19x19 ft', '15x15x15 ft', 'Ages 3-10', 95000),

    (t_id, 'Superhero Jump Arena', 'superhero-jump-arena',
     'bouncers', 'Marvel-style superhero themed bouncer with comic book art. Holds 6-8 kids comfortably. Most popular for boys 5-12.',
     16900, 18900, 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800', 2, true, false, '17x17 ft', '13x13x13 ft', 'Ages 4-12', 85000),

    -- Combos
    (t_id, 'Jump & Slide Combo', 'jump-slide-combo',
     'combos', 'Bouncer + dual-lane slide in one unit. Climb up, slide down, jump around. Hours of entertainment. Setup needs 30x18 ft area.',
     24900, 27900, 'https://images.unsplash.com/photo-1517457210348-703079e57d4b?w=800', 2, true, false, '30x18 ft', '26x13x15 ft', 'Ages 3-12', 145000),

    (t_id, 'Tropical 5-in-1 Combo', 'tropical-5in1-combo',
     'combos', 'Jump area + slide + climbing wall + basketball hoop + obstacle course. The ultimate party combo. Toddler-safe with low entrance.',
     29900, 32900, 'https://images.unsplash.com/photo-1607778417362-3a8c2c2a52e6?w=800', 1, true, false, '32x20 ft', '28x15x16 ft', 'Ages 3-12', 180000),

    -- Water Slides
    (t_id, 'Tidal Wave Water Slide 20ft', 'tidal-wave-water-slide-20ft',
     'water-slides', '20-foot tall water slide with splash pool. Hose hookup included. Perfect for summer parties when temps hit 80°F+. Sandbags + tarp included.',
     34900, 37900, 'https://images.unsplash.com/photo-1622820937515-bb12d6ce2c1d?w=800', 1, true, false, '30x15 ft', '24x10x20 ft', 'Ages 5+', 220000),

    (t_id, 'Dual Lane Slip-N-Slide 30ft', 'dual-lane-slip-n-slide-30ft',
     'water-slides', '30-foot slip-n-slide with two lanes for racing. Sprinkler system keeps it slick all day. Great for hot summer days, requires garden hose access.',
     19900, 22900, 'https://images.unsplash.com/photo-1597823469960-9bef8e58da9b?w=800', 2, true, false, '35x10 ft', '30x6x3 ft', 'Ages 6+', 95000),

    -- Add-ons (sold alongside main rental)
    (t_id, 'Folding Chair', 'folding-chair',
     'addons', 'White resin folding chair, 18" seat height. Sold per chair per day. Bulk discount on packages.',
     200, null, 'https://images.unsplash.com/photo-1503602642458-232111445657?w=800', 100, true, true, null, null, null, 800),

    (t_id, 'Rectangular Table 6ft', 'rectangular-table-6ft',
     'addons', 'White plastic banquet table, seats 6-8. Foldable. Per table per day.',
     900, null, 'https://images.unsplash.com/photo-1571919743851-c4df8b6ee133?w=800', 30, true, true, null, '72x30 inches', null, 4500),

    (t_id, 'Cotton Candy Machine', 'cotton-candy-machine',
     'addons', 'Stainless steel cotton candy machine with 50 servings of sugar + cones included. Plugs into standard outlet.',
     5900, null, 'https://images.unsplash.com/photo-1583244183614-bdf1a0e3c5b8?w=800', 4, true, true, null, null, null, 25000),

    (t_id, 'Snow Cone Machine', 'snow-cone-machine',
     'addons', 'Includes ice scraper, 100 paper cups, 4 syrup flavors (cherry, blue raspberry, grape, lemon). Plugs into standard outlet.',
     4900, null, 'https://images.unsplash.com/photo-1599627446789-1c0d3a45ba14?w=800', 3, true, true, null, null, null, 20000),

    (t_id, 'Generator (50 amp)', 'generator-50amp',
     'addons', 'For events without power access. Runs up to 8 hours on full tank. Customer provides return-with-full-tank. Per day rental.',
     8900, null, 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=800', 2, true, true, null, null, null, 60000)
  on conflict (tenant_id, slug) do nothing;

  -- 6. Packages (bundled deals)
  insert into public.packages (tenant_id, name, slug, description, price_cents, image_url, is_active)
  values
    (t_id, 'Birthday Party Package', 'birthday-party-package',
     'Castle bouncer + 4 tables + 32 chairs + cotton candy machine. Perfect for kids birthday parties 4-12 years old.',
     34900, 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800', true),

    (t_id, 'Summer Cool-Down Package', 'summer-cool-down',
     'Water slide + slip-n-slide + 6 tables + 50 chairs + snow cone machine + 50 cups. Beat the Florida heat.',
     69900, 'https://images.unsplash.com/photo-1622820937515-bb12d6ce2c1d?w=800', true),

    (t_id, 'Princess Tea Party', 'princess-tea-party',
     'Princess Palace bouncer + 4 tables + 24 chairs + cotton candy machine. Includes pink table linens.',
     42900, 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800', true)
  on conflict (tenant_id, slug) do nothing;

  -- 7. Inventory items (operational gear, NOT rentable products)
  insert into public.inventory_items
    (tenant_id, name, category, quantity_owned, quantity_in_use, condition, is_active, low_stock_threshold)
  values
    (t_id, 'Blower 1HP (BLW-01..04)', 'blowers', 4, 0, 'good', true, 1),
    (t_id, 'Extension Cord 50ft', 'cords', 8, 0, 'good', true, 2),
    (t_id, 'Sandbags 25lb', 'anchors', 24, 0, 'good', true, 6),
    (t_id, 'Ground Stakes 18in', 'anchors', 30, 0, 'good', true, 10),
    (t_id, 'Tarp 20x20', 'protection', 6, 0, 'good', true, 2),
    (t_id, 'Garden Hose 50ft (water slides)', 'water', 3, 0, 'good', true, 1)
  on conflict do nothing;

  -- 8. Fleet (vehicles for delivery)
  insert into public.vehicles (tenant_id, name, license_plate, vin, vehicle_type, is_active)
  values
    (t_id, 'White Cargo Van', 'DEMO-001', 'DEMO0000000000001', 'cargo_van', true)
  on conflict do nothing;

  insert into public.trailers (tenant_id, name, license_plate, vin, is_active)
  values
    (t_id, '8x12 Enclosed Trailer', 'DEMO-TR1', 'DEMO0000000000002', true)
  on conflict do nothing;

  -- 9. Sample FAQs
  insert into public.faqs (tenant_id, question, answer, display_order, is_active)
  values
    (t_id, 'How far in advance should I book?', 'We recommend at least 2 weeks for summer weekends. Last-minute bookings (less than 48 hours) often available — call us.', 1, true),
    (t_id, 'What if it rains?', 'Free reschedule within 30 days. We also offer a weather cancellation credit option in your portal — full credit toward a future rental.', 2, true),
    (t_id, 'Do you deliver and set up?', 'Yes! Delivery + setup + takedown all included in the price for the Tampa Bay area (within 20 miles). Beyond that, small fee applies.', 3, true),
    (t_id, 'How much space do I need?', 'Each product page lists the setup area required. Generally 3-5 feet of clearance around the unit, flat ground, no overhead power lines.', 4, true)
  on conflict do nothing;

  -- 10. Sample reviews (customer testimonials shown on /reviews)
  insert into public.reviews
    (tenant_id, customer_name, customer_city, rating, body, is_featured, is_active)
  values
    (t_id, 'Sarah M.', 'Tampa, FL', 5,
     'Booked the Princess Palace for my daughter''s 6th birthday. Showed up on time, set up perfectly, kids LOVED it. Will definitely book again next year.',
     true, true),

    (t_id, 'Mike R.', 'St. Petersburg, FL', 5,
     'Got the Summer Cool-Down package for our company picnic. Water slide was a hit with both kids AND adults. Easy online booking, no hassle.',
     true, true),

    (t_id, 'Jessica T.', 'Clearwater, FL', 5,
     'The cotton candy machine was perfect for our school carnival. The team showed me how to use it and it ran all afternoon. Highly recommend!',
     true, true)
  on conflict do nothing;

  raise notice '✓ demo seed complete for testbouncers';
end $$;

notify pgrst, 'reload schema';
