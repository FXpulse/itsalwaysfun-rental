-- ─────────────────────────────────────────────────────────────────────────
-- DEMO SEED EXTRA — operational data for testbouncers tenant
-- ─────────────────────────────────────────────────────────────────────────
-- Run AFTER seed_demo_testbouncers.sql. Adds:
--   - Correct hero_title/subtitle/tagline/cta_label (fixing the
--     "Welcome to It's Always Fun" defaults leak)
--   - Trust bar + footer + section titles tenant-branded
--   - 10 sample bookings spanning past/today/upcoming (paid + pending)
--   - 3 quotes in different states
--   - 4 contact messages (some resolved, some open)
--   - 5 coupons
--   - 4 issued gift cards
--   - 3 overhead lines (rent, insurance, software)
--   - 1 home banner
--   - 2 active home_banners
--   - Signed waiver on one booking
--   - 1 COI request
--
-- Idempotent (uses ON CONFLICT or skip-if-exists patterns).
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  t_id uuid;
  prod_castle uuid; prod_princess uuid; prod_superhero uuid;
  prod_combo uuid; prod_waterslide uuid;
  prod_chair uuid; prod_table uuid;
  pkg_birthday uuid;
  booking_1 uuid; booking_2 uuid; booking_3 uuid;
begin
  select id into t_id from public.tenants where slug = 'testbouncers';
  if t_id is null then
    raise notice '⚠ testbouncers tenant not found — run signup first';
    return;
  end if;

  -- ── 1. CORRECT hero + branded copy (fixes the "Welcome to It's Always Fun" leak) ──
  insert into public.site_settings (tenant_id, key, value, description, category) values
    (t_id, 'hero_title', 'Welcome to Test Bouncers Party Rentals', 'Hero', 'content'),
    (t_id, 'hero_subtitle', 'Bounce houses, water slides, and party rentals delivered to your door in Tampa Bay. Setup + takedown included.', 'Hero', 'content'),
    (t_id, 'hero_tagline', 'Because every party deserves a bounce house!', 'Hero italic line', 'content'),
    (t_id, 'hero_cta_label', 'See available dates →', 'Hero CTA', 'content'),
    (t_id, 'section_categories_title', 'Pick your favorite — book in 60 seconds', 'Categories title', 'content'),
    (t_id, 'section_featured_title', 'Most popular rentals', 'Featured title', 'content'),
    (t_id, 'trust_delivery', 'Free Delivery — Within Tampa Bay (20 mi)', 'Trust bar', 'content'),
    (t_id, 'trust_cleaned', 'Sanitized — After every rental, no exceptions', 'Trust bar', 'content'),
    (t_id, 'trust_rating', '5-Star Reviews — Trusted by Tampa families', 'Trust bar', 'content'),
    (t_id, 'footer_description', 'Test Bouncers Party Rentals — bounce houses, water slides, tables, chairs, and more delivered across Tampa Bay. Family-owned, fully insured.', 'Footer', 'content'),
    (t_id, 'service_area', 'Tampa, St. Pete, Clearwater + 20 miles around', 'Service area', 'general'),
    (t_id, 'instagram_url', 'https://instagram.com/testbouncers', 'IG', 'social'),
    (t_id, 'facebook_url', 'https://facebook.com/testbouncers', 'FB', 'social')
  on conflict (tenant_id, key) do update
    set value = excluded.value;

  -- Get product IDs for bookings
  select id into prod_castle from public.products where tenant_id = t_id and slug = 'castle-bouncer-13x13';
  select id into prod_princess from public.products where tenant_id = t_id and slug = 'princess-palace-15x15';
  select id into prod_superhero from public.products where tenant_id = t_id and slug = 'superhero-jump-arena';
  select id into prod_combo from public.products where tenant_id = t_id and slug = 'jump-slide-combo';
  select id into prod_waterslide from public.products where tenant_id = t_id and slug = 'tidal-wave-water-slide-20ft';
  select id into prod_chair from public.products where tenant_id = t_id and slug = 'folding-chair';
  select id into prod_table from public.products where tenant_id = t_id and slug = 'rectangular-table-6ft';
  select id into pkg_birthday from public.packages where tenant_id = t_id and slug = 'birthday-party-package';

  -- ── 2. BOOKINGS — mix of past/today/upcoming, paid/pending ─────
  insert into public.bookings (
    tenant_id, product_id, product_name, total_amount,
    customer_first_name, customer_last_name, customer_email, customer_phone, customer_address,
    event_date, event_end_date, start_time, end_time,
    stripe_payment_status, booking_status, surface_type, payment_method
  ) values
    -- 2 past completed
    (t_id, prod_castle, 'Castle Bouncer 13x13', 14900,
     'Sarah', 'Martinez', 'sarah.demo@example.com', '+1-813-555-0101', '742 Main St, Tampa FL 33602',
     current_date - 14, current_date - 14, '09:00', '17:00',
     'paid', 'completed', 'grass', 'stripe'),

    (t_id, prod_princess, 'Princess Palace 15x15', 17900,
     'Maria', 'Lopez', 'maria.demo@example.com', '+1-813-555-0102', '1234 Bay Ave, St Petersburg FL 33701',
     current_date - 7, current_date - 7, '10:00', '18:00',
     'paid', 'completed', 'grass', 'stripe'),

    -- 1 today, in dispatch
    (t_id, prod_combo, 'Jump & Slide Combo', 24900,
     'Jessica', 'Taylor', 'jessica.demo@example.com', '+1-727-555-0103', '500 Beach Blvd, Clearwater FL 33767',
     current_date, current_date, '09:00', '17:00',
     'paid', 'delivered', 'grass', 'stripe'),

    -- 3 upcoming paid
    (t_id, prod_superhero, 'Superhero Jump Arena', 16900,
     'Michael', 'Brown', 'mike.demo@example.com', '+1-813-555-0104', '888 Oak St, Tampa FL 33603',
     current_date + 3, current_date + 3, '11:00', '19:00',
     'paid', 'confirmed', 'concrete', 'stripe'),

    (t_id, prod_waterslide, 'Tidal Wave Water Slide 20ft', 34900,
     'Amanda', 'Wilson', 'amanda.demo@example.com', '+1-727-555-0105', '321 Sunset Dr, St Petersburg FL 33702',
     current_date + 7, current_date + 7, '12:00', '20:00',
     'paid', 'confirmed', 'grass', 'stripe'),

    (t_id, prod_castle, 'Castle Bouncer 13x13', 19370,  -- multi-day
     'David', 'Garcia', 'david.demo@example.com', '+1-813-555-0106', '99 Park Pl, Tampa FL 33604',
     current_date + 10, current_date + 11, '10:00', '18:00',
     'paid', 'confirmed', 'grass', 'stripe'),

    -- 2 pending payment
    (t_id, prod_princess, 'Princess Palace 15x15', 17900,
     'Lauren', 'Robinson', 'lauren.demo@example.com', '+1-813-555-0107', '654 Elm St, Tampa FL 33605',
     current_date + 14, current_date + 14, '10:00', '18:00',
     'pending', 'pending_payment', 'grass', null),

    (t_id, prod_combo, 'Jump & Slide Combo', 24900,
     'Carlos', 'Hernandez', 'carlos.demo@example.com', '+1-727-555-0108', '111 Pine Rd, St Petersburg FL 33703',
     current_date + 21, current_date + 21, '11:00', '19:00',
     'pending', 'pending_payment', 'paver', null),

    -- 1 refunded
    (t_id, prod_waterslide, 'Tidal Wave Water Slide 20ft', 34900,
     'Sophia', 'Anderson', 'sophia.demo@example.com', '+1-813-555-0109', '222 Maple Ave, Tampa FL 33606',
     current_date - 21, current_date - 21, '10:00', '18:00',
     'refunded', 'cancelled', 'grass', 'stripe'),

    -- 1 large package booking
    (t_id, prod_castle, 'Birthday Party Package', 34900,
     'Patricia', 'Thomas', 'patricia.demo@example.com', '+1-813-555-0110', '555 Cherry Ln, Tampa FL 33607',
     current_date + 4, current_date + 4, '13:00', '21:00',
     'paid', 'confirmed', 'grass', 'stripe')
  on conflict do nothing;

  -- Grab a couple of booking IDs for waivers/COI
  select id into booking_1 from public.bookings where tenant_id = t_id and customer_email = 'amanda.demo@example.com';
  select id into booking_2 from public.bookings where tenant_id = t_id and customer_email = 'patricia.demo@example.com';
  select id into booking_3 from public.bookings where tenant_id = t_id and customer_email = 'sarah.demo@example.com';

  -- ── 3. SIGNED WAIVER on one booking ────────────────────────────
  if booking_1 is not null and to_regclass('public.booking_waivers') is not null then
    insert into public.booking_waivers (
      tenant_id, booking_id, signed_name, signed_email,
      waiver_title_snapshot, waiver_text_snapshot, signed_at
    ) values (
      t_id, booking_1, 'Amanda Wilson', 'amanda.demo@example.com',
      'Rental Agreement & Liability Waiver',
      'I, Amanda Wilson, acknowledge that I have read and agreed to the rental agreement and liability waiver for my booking on ' || (current_date + 7)::text,
      now() - interval '2 days'
    )
    on conflict do nothing;
  end if;

  -- ── 4. COI REQUEST on one booking ─────────────────────────────
  if booking_2 is not null then
    insert into public.coi_requests (
      tenant_id, booking_id, venue_name, venue_address, additional_insured,
      special_instructions, requested_by_email, status, requested_at
    ) values (
      t_id, booking_2, 'Tampa Bay Country Club', '5555 Country Club Dr, Tampa FL 33620',
      'Tampa Bay Country Club, Inc.',
      'Please list as Additional Insured. Need by ' || (current_date + 2)::text,
      'patricia.demo@example.com', 'requested', now() - interval '1 day'
    )
    on conflict do nothing;
  end if;

  -- ── 5. QUOTES (3 — sent, viewed, accepted) ─────────────────────
  insert into public.quotes (
    tenant_id, quote_number, customer_first_name, customer_last_name, customer_email,
    customer_phone, event_date, total_cents, status, sent_at, token, expires_at
  ) values
    (t_id, 'Q-2026-001', 'Sandra', 'Mitchell', 'sandra.demo@example.com',
     '+1-813-555-0201', current_date + 30, 89900, 'sent',
     now() - interval '3 days',
     md5(random()::text || clock_timestamp()::text), current_date + 14),

    (t_id, 'Q-2026-002', 'Tom', 'Roberts', 'tom.demo@example.com',
     '+1-727-555-0202', current_date + 45, 124900, 'viewed',
     now() - interval '5 days',
     md5(random()::text || clock_timestamp()::text), current_date + 9),

    (t_id, 'Q-2026-003', 'Linda', 'Walker', 'linda.demo@example.com',
     '+1-813-555-0203', current_date - 10, 64900, 'approved',
     now() - interval '15 days',
     md5(random()::text || clock_timestamp()::text), current_date - 1)
  on conflict do nothing;

  -- ── 6. CONTACT MESSAGES (4) ────────────────────────────────────
  insert into public.contact_messages (
    tenant_id, first_name, last_name, email, phone, subject, message,
    source, is_resolved, created_at
  ) values
    (t_id, 'Rachel', 'Foster', 'rachel.demo@example.com', '+1-813-555-0301',
     'Question about water slide rental',
     'Hi! I''m planning a 7-year-old''s birthday party on July 4th — do you have a smaller water slide for younger kids?',
     'web', false, now() - interval '1 day'),

    (t_id, 'Daniel', 'Kim', 'daniel.demo@example.com', '+1-727-555-0302',
     'Bulk order for school carnival',
     'Our school needs 3 bouncers + 100 chairs + 20 tables for a fall carnival in October. Can you give us a bulk quote?',
     'web', false, now() - interval '3 hours'),

    (t_id, 'Emily', 'Carter', 'emily.demo@example.com', '+1-813-555-0303',
     'Thank you!',
     'Just wanted to say the bouncer rental for my daughter''s birthday was AMAZING. Delivery was on time, kids loved it. Will definitely book again!',
     'web', true, now() - interval '7 days'),

    (t_id, 'Robert', 'Davis', 'robert.demo@example.com', '+1-727-555-0304',
     'Wedding reception backdrop',
     'Do you rent any decorative bouncers for adult events? We''re having a "kids at heart" theme for our wedding reception.',
     'web', false, now() - interval '4 hours')
  on conflict do nothing;

  -- ── 7. COUPONS (5) ─────────────────────────────────────────────
  insert into public.coupons (
    tenant_id, code, discount_type, discount_value, max_uses, current_uses,
    is_active, expires_at, description
  ) values
    (t_id, 'WELCOME10', 'percent', 10, 100, 8, true, current_date + 90,
     '10% off first booking'),
    (t_id, 'SUMMER25', 'percent', 25, 50, 12, true, current_date + 60,
     '25% off any water slide for summer'),
    (t_id, 'BIRTHDAY15', 'percent', 15, null, 47, true, current_date + 365,
     '15% off — birthday parties'),
    (t_id, 'EARLYBIRD', 'fixed', 2500, 30, 6, true, current_date + 30,
     '$25 off when you book 2+ weeks in advance'),
    (t_id, 'EXPIRED', 'percent', 50, 10, 10, false, current_date - 30,
     '50% off — used up + expired (example of inactive)')
  on conflict do nothing;

  -- ── 8. GIFT CARDS (4 issued) ──────────────────────────────────
  insert into public.gift_cards (
    tenant_id, code, original_amount_cents, balance_cents,
    purchaser_name, purchaser_email,
    recipient_name, recipient_email,
    message, is_active, expires_at, issued_at
  ) values
    (t_id, 'GC-DEMO-001', 10000, 10000, 'John Smith', 'john.demo@example.com',
     'Sarah Smith', 'sarah.smith.demo@example.com',
     'Happy birthday, sis! Use this for a fun party 🎉',
     true, current_date + 365, now() - interval '5 days'),

    (t_id, 'GC-DEMO-002', 25000, 12500, 'Tom Anderson', 'tom.a.demo@example.com',
     'Emily Anderson', 'emily.a.demo@example.com',
     'Anniversary gift — book something fun!',
     true, current_date + 365, now() - interval '30 days'),

    (t_id, 'GC-DEMO-003', 5000, 5000, 'Maria Garcia', 'maria.g.demo@example.com',
     null, 'gift.demo@example.com',
     null,
     true, current_date + 365, now() - interval '2 days'),

    (t_id, 'GC-DEMO-004', 15000, 0, 'David Lopez', 'david.l.demo@example.com',
     'David Lopez', 'david.l.demo@example.com',
     null,
     true, current_date + 365, now() - interval '60 days')
  on conflict (tenant_id, code) do nothing;

  -- ── 9. OVERHEAD LINES (5 monthly costs) ───────────────────────
  if to_regclass('public.overhead_costs') is not null then
    insert into public.overhead_costs (
      tenant_id, name, category, monthly_cents, effective_from, notes
    ) values
      (t_id, 'Warehouse rent (Tampa)', 'rent', 150000, current_date - interval '180 days', 'Storage + small office, ~1200 sqft'),
      (t_id, 'General liability insurance', 'insurance', 32500, current_date - interval '365 days', 'Annual policy paid monthly'),
      (t_id, 'Vehicle insurance (van + trailer)', 'insurance_vehicle', 18900, current_date - interval '180 days', null),
      (t_id, 'Software (Stripe, Vercel, GHL, etc.)', 'software', 14500, current_date - interval '120 days', 'Includes RentalFlow subscription'),
      (t_id, 'Marketing (Google ads)', 'marketing', 30000, current_date - interval '90 days', 'Q4 push')
    on conflict do nothing;
  end if;

  -- ── 10. HOME BANNERS (1 promo banner) ─────────────────────────
  if to_regclass('public.home_banners') is not null then
    insert into public.home_banners (
      tenant_id, image_url, alt_text, link_url, sort_order, is_active
    ) values
      (t_id,
       'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1600&h=400&fit=crop',
       'Summer special — 25% off water slides',
       '/items/tidal-wave-water-slide-20ft',
       1, true)
    on conflict do nothing;
  end if;

  raise notice '✓ extra demo seed complete for testbouncers';
end $$;

notify pgrst, 'reload schema';
