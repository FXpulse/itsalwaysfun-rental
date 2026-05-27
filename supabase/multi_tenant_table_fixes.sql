-- ─────────────────────────────────────────────────────────────────────────
-- MULTI-TENANT FIX — wrong table names in previous migrations
-- ─────────────────────────────────────────────────────────────────────────
-- Chunks 1A/1D referenced tables by incorrect names:
--   - "reviews" → actual name is "customer_reviews"
--   - "audit_log" → actual name is "admin_audit_log"
--   - "gift_card_transactions" → doesn't exist (use redemptions/purchases)
--   - "quote_items" → doesn't exist
--   - "loyalty_points_history" → doesn't exist (loyalty_transactions does)
--
-- Result: these tables don't have tenant_id columns, RLS policies, or
-- composite uniques. This migration fixes that.
--
-- Idempotent. Run AFTER multi_tenant_foundation.sql + multi_tenant_rls.sql.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Add tenant_id to the correct tables ────────────────────────────
do $$
declare
  t text;
  tables_to_fix text[] := array[
    'customer_reviews',
    'admin_audit_log',
    'gift_card_redemptions',
    'gift_card_purchases',
    'loyalty_transactions'
  ];
begin
  foreach t in array tables_to_fix loop
    if to_regclass('public.' || t) is null then
      raise notice '⊘ skip %: table does not exist', t;
      continue;
    end if;

    -- Add tenant_id with IAF default for backfill
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid not null default %L references public.tenants(id) on delete restrict',
      t, '11111111-1111-1111-1111-111111111111'
    );

    -- Index
    execute format(
      'create index if not exists %I on public.%I(tenant_id)',
      t || '_tenant_id_idx', t
    );

    -- tenant_isolation RLS policy
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format($f$
      create policy tenant_isolation on public.%I
        as permissive
        for all
        using (
          public.is_superadmin(auth.uid())
          or tenant_id = public.current_tenant_id()
        )
        with check (
          public.is_superadmin(auth.uid())
          or tenant_id = public.current_tenant_id()
        )
    $f$, t);

    raise notice '✓ tenant_id + RLS added to %', t;
  end loop;
end $$;

notify pgrst, 'reload schema';
