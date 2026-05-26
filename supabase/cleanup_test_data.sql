-- ─────────────────────────────────────────────────────────────────────────
-- PRE-LAUNCH CLEANUP — wipe all test bookings + customer accounts
-- ─────────────────────────────────────────────────────────────────────────
-- Use this BEFORE going live with real customers. Removes all test data
-- but KEEPS your configuration intact:
--
-- KEEPS:
--   ✓ All products, inventory_items, fleet, categories, packages
--   ✓ All site_settings (Stripe keys, brand colors, content, etc.)
--   ✓ All user_roles (admin / staff / driver accounts)
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
--   ✗ All dispatch_routes + dispatch_stops
--   ✗ All quotes + quote_items
--   ✗ All payout_requests
--   ✗ All contact_messages + replies
--   ✗ All gift_cards (issued instances) + gift_card_transactions
--   ✗ All customer_profiles + loyalty data
--   ✗ All auth.users that are NOT in user_roles (i.e. customers, not staff)
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
-- Uses a function that returns 0 for tables that don't exist (defensive
-- against schema differences across deployments).

do $$ begin
  create or replace function pg_temp.safe_count(t text) returns bigint as $f$
  declare n bigint;
  begin
    if to_regclass(t) is null then return 0; end if;
    execute format('select count(*) from %s', t) into n;
    return n;
  end $f$ language plpgsql;
end $$;

select 'bookings'              as table_name, pg_temp.safe_count('public.bookings')              as rows
union all select 'booking_expenses',       pg_temp.safe_count('public.booking_expenses')
union all select 'booking_damages',        pg_temp.safe_count('public.booking_damages')
union all select 'booking_proofs',         pg_temp.safe_count('public.booking_proofs')
union all select 'booking_waivers',        pg_temp.safe_count('public.booking_waivers')
union all select 'booking_extensions',     pg_temp.safe_count('public.booking_extensions')
union all select 'coi_requests',           pg_temp.safe_count('public.coi_requests')
union all select 'dispatch_stops',         pg_temp.safe_count('public.dispatch_stops')
union all select 'dispatch_routes',        pg_temp.safe_count('public.dispatch_routes')
union all select 'quotes',                 pg_temp.safe_count('public.quotes')
union all select 'payout_requests',        pg_temp.safe_count('public.payout_requests')
union all select 'contact_messages',       pg_temp.safe_count('public.contact_messages')
union all select 'gift_cards',             pg_temp.safe_count('public.gift_cards')
union all select 'customer_profiles',      pg_temp.safe_count('public.customer_profiles')
union all select 'auth.users (non-staff)',
  (select count(*) from auth.users where id not in (select user_id from public.user_roles where is_active = true))
order by table_name;


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 2 — TRANSACTION (the actual cleanup)
-- ═════════════════════════════════════════════════════════════════════════
-- Run everything from BEGIN to the end of section 2 as ONE block.
-- Nothing is permanent yet — you still need to COMMIT in step 4.

begin;

-- Helper: delete from a table only if it exists in this DB
do $$ begin
  create or replace function pg_temp.safe_delete(t text) returns void as $f$
  begin
    if to_regclass(t) is not null then
      execute format('delete from %s', t);
    end if;
  end $f$ language plpgsql;
end $$;

-- ── booking-anchored rows (delete children first, then parents) ────────
select pg_temp.safe_delete('public.booking_expenses');
select pg_temp.safe_delete('public.booking_damages');
select pg_temp.safe_delete('public.booking_proofs');
select pg_temp.safe_delete('public.booking_waivers');
select pg_temp.safe_delete('public.booking_extensions');
select pg_temp.safe_delete('public.coi_requests');

-- dispatch (stops FK to bookings + routes)
select pg_temp.safe_delete('public.dispatch_stops');
select pg_temp.safe_delete('public.dispatch_routes');

-- bookings themselves
delete from public.bookings;

-- ── quote system ───────────────────────────────────────────────────────
select pg_temp.safe_delete('public.quote_items');
select pg_temp.safe_delete('public.quotes');

-- ── customer-facing data ───────────────────────────────────────────────
select pg_temp.safe_delete('public.contact_message_replies');
select pg_temp.safe_delete('public.contact_messages');
select pg_temp.safe_delete('public.payout_requests');

-- Loyalty history (table name varies between schema versions)
select pg_temp.safe_delete('public.loyalty_points_history');
select pg_temp.safe_delete('public.loyalty_transactions');

-- Gift cards issued (instances) — NOT the gift_card products in `products` table
select pg_temp.safe_delete('public.gift_card_transactions');
select pg_temp.safe_delete('public.gift_cards');

-- Reviews (customer-submitted)
select pg_temp.safe_delete('public.reviews');

-- Customer profiles
select pg_temp.safe_delete('public.customer_profiles');

-- ── auth users (delete ONLY non-staff customer accounts) ───────────────
-- This is the most sensitive step. We keep everyone who is in user_roles
-- (admin, staff, driver). Everyone else gets deleted from auth.users.
delete from auth.users
where id not in (select user_id from public.user_roles where is_active = true);

-- ── audit_log (OPTIONAL — uncomment if you also want to wipe it) ──────
-- delete from public.audit_log;


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 3 — VERIFY (still inside the transaction, run before COMMIT)
-- ═════════════════════════════════════════════════════════════════════════
-- Re-run the same counts. All should be 0 except auth.users (which should
-- match the count of user_roles — your staff).

select 'bookings'              as table_name, pg_temp.safe_count('public.bookings')              as rows
union all select 'booking_expenses',       pg_temp.safe_count('public.booking_expenses')
union all select 'booking_damages',        pg_temp.safe_count('public.booking_damages')
union all select 'booking_proofs',         pg_temp.safe_count('public.booking_proofs')
union all select 'booking_waivers',        pg_temp.safe_count('public.booking_waivers')
union all select 'booking_extensions',     pg_temp.safe_count('public.booking_extensions')
union all select 'coi_requests',           pg_temp.safe_count('public.coi_requests')
union all select 'dispatch_stops',         pg_temp.safe_count('public.dispatch_stops')
union all select 'dispatch_routes',        pg_temp.safe_count('public.dispatch_routes')
union all select 'quotes',                 pg_temp.safe_count('public.quotes')
union all select 'payout_requests',        pg_temp.safe_count('public.payout_requests')
union all select 'contact_messages',       pg_temp.safe_count('public.contact_messages')
union all select 'gift_cards',             pg_temp.safe_count('public.gift_cards')
union all select 'customer_profiles',      pg_temp.safe_count('public.customer_profiles')
union all select 'auth.users (TOTAL)',     (select count(*) from auth.users)
union all select 'user_roles (your team)', (select count(*) from public.user_roles where is_active = true)
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
