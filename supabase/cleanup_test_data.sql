-- ─────────────────────────────────────────────────────────────────────────
-- PRE-LAUNCH CLEANUP — wipe all test bookings + customer accounts
-- ─────────────────────────────────────────────────────────────────────────
-- Use this BEFORE going live with real customers. Removes all test data
-- but KEEPS your configuration intact:
--
-- KEEPS:
--   ✓ All products, inventory_items, fleet, categories, packages
--   ✓ All site_settings (Stripe keys, brand colors, content, etc.)
--   ✓ All app_users (admin / staff / driver accounts)
--   ✓ All coupons, gift_card configurations (templates)
--   ✓ All overhead_costs, overhead_categories, booking_expense_categories
--   ✓ All faqs, banners, reviews
--   ✓ audit_log (kept by default — comment out the DELETE line below if
--     you want to wipe it too)
--
-- WIPES:
--   ✗ All bookings + booking_expenses, booking_damages, booking_proofs,
--     booking_waivers, booking_extensions
--   ✗ All coi_requests
--   ✗ All dispatch_routes + dispatch_route_stops
--   ✗ All quotes + quote_items
--   ✗ All payout_requests
--   ✗ All contact_messages + replies
--   ✗ All gift_cards (issued instances) + gift_card_transactions
--   ✗ All customer_profiles + loyalty data
--   ✗ All auth.users that are NOT in app_users (i.e. customers, not staff)
--
-- ─────────────────────────────────────────────────────────────────────────
-- HOW TO USE (run in Supabase → SQL editor):
--
-- STEP 1: Run "SECTION 1 — PREVIEW" to see what will be deleted
-- STEP 2: Run "SECTION 2 — TRANSACTION" (everything from BEGIN to the end)
-- STEP 3: Run "SECTION 3 — VERIFY" to confirm counts dropped to 0
-- STEP 4: Run "COMMIT;" by itself if happy, OR "ROLLBACK;" to undo
--
-- The transaction means NOTHING is permanent until you COMMIT. If anything
-- looks wrong after step 3, just type ROLLBACK; and you're back to where
-- you started.
-- ─────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 1 — PREVIEW (read-only, safe to run anytime)
-- ═════════════════════════════════════════════════════════════════════════
-- Just shows you what's about to disappear. Run this first.

select 'bookings'                  as table_name, count(*) as rows from public.bookings
union all select 'booking_expenses',         count(*) from public.booking_expenses
union all select 'booking_damages',          count(*) from public.booking_damages
union all select 'booking_proofs',           count(*) from public.booking_proofs
union all select 'booking_waivers',          count(*) from public.booking_waivers
union all select 'booking_extensions',       count(*) from public.booking_extensions
union all select 'coi_requests',             count(*) from public.coi_requests
union all select 'dispatch_route_stops',     count(*) from public.dispatch_route_stops
union all select 'dispatch_routes',          count(*) from public.dispatch_routes
union all select 'quotes',                   count(*) from public.quotes
union all select 'payout_requests',          count(*) from public.payout_requests
union all select 'contact_messages',         count(*) from public.contact_messages
union all select 'gift_cards',               count(*) from public.gift_cards
union all select 'customer_profiles',        count(*) from public.customer_profiles
union all select 'auth.users (non-staff)',
  (select count(*) from auth.users where id not in (select id from public.app_users))
order by table_name;


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 2 — TRANSACTION (the actual cleanup)
-- ═════════════════════════════════════════════════════════════════════════
-- Run everything from BEGIN to the end of section 2 as ONE block.
-- Nothing is permanent yet — you still need to COMMIT in step 4.

begin;

-- ── booking-anchored rows (delete children first, then parents) ────────
delete from public.booking_expenses;
delete from public.booking_damages;
delete from public.booking_proofs;
delete from public.booking_waivers;
delete from public.booking_extensions;
delete from public.coi_requests;

-- dispatch (stops FK to bookings + routes)
delete from public.dispatch_route_stops;
delete from public.dispatch_routes;

-- bookings themselves
delete from public.bookings;

-- ── quote system ───────────────────────────────────────────────────────
-- quote_items may or may not exist depending on your schema version
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='quote_items') then
    delete from public.quote_items;
  end if;
end $$;
delete from public.quotes;

-- ── customer-facing data ───────────────────────────────────────────────
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='contact_message_replies') then
    delete from public.contact_message_replies;
  end if;
end $$;
delete from public.contact_messages;

delete from public.payout_requests;

-- Loyalty history — different schemas use different table names; cover both
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='loyalty_points_history') then
    delete from public.loyalty_points_history;
  end if;
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='loyalty_transactions') then
    delete from public.loyalty_transactions;
  end if;
end $$;

-- Gift cards issued (instances) — NOT the gift_card products in `products` table
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='gift_card_transactions') then
    delete from public.gift_card_transactions;
  end if;
end $$;
delete from public.gift_cards;

-- Reviews (customer-submitted)
do $$ begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='reviews') then
    delete from public.reviews;
  end if;
end $$;

-- Customer profiles
delete from public.customer_profiles;

-- ── auth users (delete ONLY non-staff customer accounts) ───────────────
-- This is the most sensitive step. We keep everyone who is in app_users
-- (admin, staff, driver). Everyone else gets deleted from auth.users.
delete from auth.users
where id not in (select id from public.app_users);

-- ── audit_log (OPTIONAL — uncomment if you also want to wipe it) ──────
-- delete from public.audit_log;


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 3 — VERIFY (still inside the transaction, run before COMMIT)
-- ═════════════════════════════════════════════════════════════════════════
-- Re-run the same counts. All should be 0 except auth.users (which should
-- match the count of app_users — your staff).

select 'bookings'                  as table_name, count(*) as rows from public.bookings
union all select 'booking_expenses',         count(*) from public.booking_expenses
union all select 'booking_damages',          count(*) from public.booking_damages
union all select 'booking_proofs',           count(*) from public.booking_proofs
union all select 'booking_waivers',          count(*) from public.booking_waivers
union all select 'booking_extensions',       count(*) from public.booking_extensions
union all select 'coi_requests',             count(*) from public.coi_requests
union all select 'dispatch_route_stops',     count(*) from public.dispatch_route_stops
union all select 'dispatch_routes',          count(*) from public.dispatch_routes
union all select 'quotes',                   count(*) from public.quotes
union all select 'payout_requests',          count(*) from public.payout_requests
union all select 'contact_messages',         count(*) from public.contact_messages
union all select 'gift_cards',               count(*) from public.gift_cards
union all select 'customer_profiles',        count(*) from public.customer_profiles
union all select 'auth.users (TOTAL)',       (select count(*) from auth.users)
union all select 'app_users (your team)',    count(*) from public.app_users
order by table_name;


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 4 — FINALIZE (run ONE of these by itself)
-- ═════════════════════════════════════════════════════════════════════════

-- ✅ Looks good? Make it permanent:
-- commit;

-- ❌ Something off? Undo everything:
-- rollback;

-- ─────────────────────────────────────────────────────────────────────────
-- After COMMIT, you may also want to:
--   - Clear Stripe test customers from the Stripe Dashboard (Test mode →
--     Customers → bulk delete). Doesn't affect Live mode customers.
--   - Clear GHL test contacts (sub-account → Contacts → filter "test" → delete)
-- ─────────────────────────────────────────────────────────────────────────
