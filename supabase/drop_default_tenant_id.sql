-- OBS-2 fix: drop the column DEFAULT '11111111-...' (IAF tenant uuid) from
-- every multi-tenant table. This is the load-bearing change of the
-- 2026-06-10 audit — it converts the entire family of "silently leaked
-- to IAF" bugs into loud NOT NULL violations that surface immediately.
--
-- WHY: multi_tenant_foundation.sql added every table with
--   `tenant_id uuid not null default '11111111-...'` so existing rows
-- backfilled cleanly and code without tenant context still worked
-- during the transition. The transition is over. Keeping the default
-- means every future code path that forgets to pass tenant_id silently
-- writes to the IAF tenant — invisible for IAF (the default IS IAF) but
-- a P0 data leak for any other paying tenant.
--
-- SAFETY:
--   * All existing rows already have a tenant_id (the column is NOT NULL).
--     Dropping the default only affects NEW inserts.
--   * Every JS insert path that hits these tables either (a) goes through
--     the lib/tenant/scope.ts proxy (auto-injects from request headers),
--     (b) passes tenant_id explicitly, or (c) was fixed earlier in
--     today's audit (customer_tags, tenant_api_keys, tenant_webhooks,
--     PaymentIntent metadata, etc.).
--   * The two RPC paths that wrote without setting tenant_id were both
--     fixed today:
--       - ensure_customer_profile  → now takes p_tenant_id
--       - generate_inventory_units → now derives from parent
--
-- ROLLBACK (if anything breaks unexpectedly): re-add the default per table
--   ALTER TABLE public.<name> ALTER COLUMN tenant_id
--     SET DEFAULT '11111111-1111-1111-1111-111111111111'::uuid;
--
-- Idempotent — running twice is a no-op (DROP DEFAULT on a column with
-- no default succeeds without error).

do $$
declare
  t text;
  tables_to_drop text[] := array[
    'admin_audit_log',
    'booking_damages',
    'booking_expenses',
    'booking_extensions',
    'booking_proofs',
    'booking_waivers',
    'bookings',
    'categories',
    'coi_requests',
    'contact_messages',
    'coupons',
    'customer_profiles',
    'customer_reviews',
    'dispatch_routes',
    'dispatch_stops',
    'driver_tax_profiles',
    'email_templates',
    'faqs',
    'gift_card_purchases',
    'gift_card_redemptions',
    'gift_cards',
    'home_banners',
    'inventory_categories',
    'inventory_items',
    'inventory_units',
    'loyalty_transactions',
    'overhead_categories',
    'overhead_costs',
    'packages',
    'payout_requests',
    'product_images',
    'product_inventory_requirements',
    'products',
    'quotes',
    'site_settings',
    'trailers',
    'user_roles',
    'vehicles'
  ];
begin
  foreach t in array tables_to_drop loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip %: table does not exist', t;
      continue;
    end if;
    execute format('alter table public.%I alter column tenant_id drop default', t);
    raise notice 'dropped default on %', t;
  end loop;
end $$;
