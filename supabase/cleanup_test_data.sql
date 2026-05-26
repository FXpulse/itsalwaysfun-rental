-- ─────────────────────────────────────────────────────────────────────────
-- PRE-LAUNCH CLEANUP — wipe all test bookings + customer accounts
-- ─────────────────────────────────────────────────────────────────────────
-- NO TRANSACTION VERSION — each DELETE is auto-committed immediately when
-- you click Run. Faster + simpler than the transaction version (Supabase
-- SQL Editor closes sessions between Runs, which auto-rollback BEGIN blocks).
--
-- KEEPS:
--   ✓ All products, inventory_items, fleet, categories, packages
--   ✓ All site_settings (Stripe keys, brand colors, content, etc.)
--   ✓ All user_roles (admin / staff / driver accounts)
--   ✓ All coupons, gift_card products (templates)
--   ✓ All overhead_costs, overhead_categories, booking_expense_categories
--   ✓ All faqs, banners
--   ✓ audit_log (kept by default — uncomment the safe_delete call below
--     if you want to wipe it too)
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
--   ✗ All customer_profiles + loyalty data + reviews
--   ✗ All auth.users that are NOT in user_roles (i.e. customers, not staff)
--
-- ─────────────────────────────────────────────────────────────────────────
-- HOW TO USE (Supabase → SQL Editor):
--
-- STEP 1: Run "SECTION 1 — PREVIEW" alone to see what'll be deleted
-- STEP 2: Run "SECTION 2 — DELETE" alone (paste from --- DELETE --- start
--         to its end). All deletions auto-commit immediately.
-- STEP 3: Run "SECTION 3 — VERIFY" alone to confirm zeros.
--
-- ⚠ WARNING: This version has NO ROLLBACK. Once Section 2 runs, the
-- deletions are permanent. Run Section 1 first to be sure of what's going.
-- ─────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 1 — PREVIEW (read-only, safe to run anytime)
-- ═════════════════════════════════════════════════════════════════════════

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
-- SECTION 2 — DELETE (no transaction — runs immediately + permanent)
-- ═════════════════════════════════════════════════════════════════════════
-- Run the whole block below as one query. Each statement commits as it goes.

do $$
declare
  tables_to_clear text[] := array[
    -- booking children (delete before parents)
    'public.booking_expenses',
    'public.booking_damages',
    'public.booking_proofs',
    'public.booking_waivers',
    'public.booking_extensions',
    'public.coi_requests',
    -- dispatch (children first)
    'public.dispatch_stops',
    'public.dispatch_routes',
    -- bookings
    'public.bookings',
    -- quotes
    'public.quote_items',
    'public.quotes',
    -- customer-facing
    'public.contact_message_replies',
    'public.contact_messages',
    'public.payout_requests',
    'public.loyalty_points_history',
    'public.loyalty_transactions',
    'public.gift_card_transactions',
    'public.gift_cards',
    'public.reviews',
    'public.customer_profiles'
    -- uncomment to also wipe audit log:
    -- , 'public.audit_log'
  ];
  t text;
  deleted_count bigint;
begin
  foreach t in array tables_to_clear loop
    if to_regclass(t) is not null then
      execute format('delete from %s', t);
      get diagnostics deleted_count = row_count;
      raise notice '✓ deleted % rows from %', deleted_count, t;
    else
      raise notice '⊘ skipped % (table does not exist)', t;
    end if;
  end loop;

  -- Auth users (delete customers — keep active admin/staff/driver)
  delete from auth.users
  where id not in (select user_id from public.user_roles where is_active = true);
  get diagnostics deleted_count = row_count;
  raise notice '✓ deleted % auth.users (kept your team)', deleted_count;
end $$;


-- ═════════════════════════════════════════════════════════════════════════
-- SECTION 3 — VERIFY (re-run counts after the deletion)
-- ═════════════════════════════════════════════════════════════════════════
-- Everything should be 0 except auth.users (TOTAL) which equals
-- user_roles (your team).

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
union all select 'auth.users (TOTAL)',     (select count(*) from auth.users)
union all select 'user_roles (your team)', (select count(*) from public.user_roles where is_active = true)
order by table_name;
