-- supabase/fix_quote_number_unique.sql
--
-- Fixes "duplicate key value violates unique constraint
-- quotes_quote_number_key" caused by two bugs in the original setup:
--
-- 1. The unique constraint was GLOBAL (across all tenants), so tenant A
--    creating Q-2026-0005 prevented tenant B from also having Q-2026-0005.
--    With multi-tenant SaaS, each tenant should have its own sequence.
--
-- 2. next_quote_number() used `count(*) + 1` which is wrong:
--    - If a quote is deleted, the count goes down, so the next call
--      regenerates a number that already exists.
--    - It's not scoped to the calling tenant.
--    - Race condition between two simultaneous inserts.
--
-- Fix:
--   - Drop the global unique on quote_number.
--   - Add composite unique on (tenant_id, quote_number).
--   - Rewrite next_quote_number() to take tenant_id, use MAX + 1, and
--     parse the numeric suffix from existing values (not count) so
--     deletions don't cause collisions.

-- Drop the old global unique constraint
alter table public.quotes drop constraint if exists quotes_quote_number_key;

-- Add composite unique (tenant_id + quote_number)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_tenant_quote_number_key'
  ) then
    alter table public.quotes
      add constraint quotes_tenant_quote_number_key unique (tenant_id, quote_number);
  end if;
end $$;

-- Rewrite the function: takes tenant_id, uses MAX of the numeric suffix
create or replace function public.next_quote_number(p_tenant_id uuid)
returns text language plpgsql as $$
declare
  y text;
  next_n int;
begin
  y := to_char(now(), 'YYYY');

  -- Extract the numeric suffix from existing quote_numbers for this tenant + year,
  -- find the max, then add 1. Falls back to 1 if no existing quotes.
  select coalesce(
    max(
      (regexp_replace(quote_number, '^Q-' || y || '-0*', ''))::int
    ),
    0
  ) + 1
  into next_n
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_number like 'Q-' || y || '-%';

  return 'Q-' || y || '-' || lpad(next_n::text, 4, '0');
end;
$$;

-- Keep a backwards-compatible zero-arg version that pulls tenant from
-- the calling RLS context (jwt). Useful for direct SQL editor testing.
create or replace function public.next_quote_number()
returns text language plpgsql as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := nullif(current_setting('request.jwt.claims.tenant_id', true), '')::uuid;
  if v_tenant_id is null then
    -- Service-role / no-tenant context: fall back to global counter behavior
    -- but with MAX instead of count to avoid duplicate regeneration on delete
    declare
      y text;
      next_n int;
    begin
      y := to_char(now(), 'YYYY');
      select coalesce(
        max((regexp_replace(quote_number, '^Q-' || y || '-0*', ''))::int),
        0
      ) + 1
      into next_n
      from public.quotes
      where quote_number like 'Q-' || y || '-%';
      return 'Q-' || y || '-' || lpad(next_n::text, 4, '0');
    end;
  end if;
  return public.next_quote_number(v_tenant_id);
end;
$$;
