-- Fix the RLS migration's broken table references + add missing tables.
--
-- The original supabase/multi_tenant_rls.sql referenced tables 'reviews'
-- and 'audit_log' but the actual schema uses 'customer_reviews' and
-- 'admin_audit_log'. PostgreSQL's to_regclass() check silently skipped
-- both — so those tables had NO RLS enforcement. Several other multi-
-- tenant tables were also missing from the original list.
--
-- This file:
--   1. Adds RLS policies for the previously-skipped tables.
--   2. Is idempotent (drop+create) so it's safe to re-run.

do $$
declare
  t text;
  tables text[] := array[
    -- Originally listed under wrong names
    'customer_reviews',
    'admin_audit_log',
    -- Missing from the original RLS migration
    'gift_card_purchases',
    'gift_card_redemptions',
    'loyalty_transactions',
    'contact_message_replies',
    'setup_surfaces',
    'booking_waivers',
    'booking_extensions',
    'booking_proofs',
    'booking_damages'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'Skipping % — table does not exist yet', t;
      continue;
    end if;

    -- Defense-in-depth: turn on RLS even if it already is (no-op then)
    execute format('alter table public.%I enable row level security', t);

    -- Drop any existing policy so this migration is idempotent
    execute format('drop policy if exists tenant_isolation on public.%I', t);

    -- Policy: row is visible/writeable only when row.tenant_id matches the
    -- tenant resolved from the request (or service role bypasses RLS).
    -- The current_setting('request.headers') JSONB extraction is how
    -- Supabase + middleware-set x-tenant-id flow through.
    execute format($pol$
      create policy tenant_isolation
        on public.%I
        as restrictive
        for all
        to authenticated, anon
        using (
          tenant_id::text = coalesce(
            current_setting('request.headers', true)::json->>'x-tenant-id',
            ''
          )
        )
        with check (
          tenant_id::text = coalesce(
            current_setting('request.headers', true)::json->>'x-tenant-id',
            ''
          )
        );
    $pol$, t);

    raise notice 'RLS policy applied to %', t;
  end loop;
end $$;
