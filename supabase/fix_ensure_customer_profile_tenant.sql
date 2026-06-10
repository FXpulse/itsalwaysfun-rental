-- Fix: ensure_customer_profile must accept tenant_id so customer profiles
-- created from cross-tenant contexts (Stripe webhook, bulk imports) land in
-- the correct tenant. Previously the RPC inserted without setting tenant_id
-- and relied on the column DEFAULT (the IAF tenant uuid). Result: every
-- non-IAF tenant's auto-created profile silently orphaned into IAF.
--
-- Compatibility: p_tenant_id is optional so existing callers don't break
-- between code deploy and SQL apply. When omitted we LOG a warning and
-- still fall back to the IAF default so the path doesn't 500. Once all
-- callers pass an explicit value (see lib/loyalty.ts), we can flip this
-- to `not null` in a follow-up migration.

-- Drop the old single-arg signature so PostgREST doesn't get ambiguous
-- overloads. CREATE OR REPLACE only matches a function with the same
-- argument list; the old (uid uuid) signature would otherwise linger
-- and a caller could land on it accidentally.
drop function if exists public.ensure_customer_profile(uid uuid);

create or replace function public.ensure_customer_profile(
  uid uuid,
  p_tenant_id uuid default null
)
returns text
language plpgsql
as $$
declare
  existing_code text;
  new_code text;
  effective_tenant uuid;
begin
  if p_tenant_id is null then
    raise warning 'ensure_customer_profile called without p_tenant_id for uid=%; falling back to IAF default. Fix the caller.', uid;
    effective_tenant := '11111111-1111-1111-1111-111111111111'::uuid;
  else
    effective_tenant := p_tenant_id;
  end if;

  select referral_code into existing_code
    from public.customer_profiles
    where user_id = uid;
  if existing_code is not null then
    return existing_code;
  end if;

  new_code := public.generate_referral_code();
  insert into public.customer_profiles (user_id, referral_code, tenant_id)
    values (uid, new_code, effective_tenant)
    on conflict (user_id) do nothing;

  -- Re-read in case of race
  select referral_code into existing_code
    from public.customer_profiles
    where user_id = uid;
  return existing_code;
end;
$$;
