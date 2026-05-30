-- supabase/referrer_coupons.sql
--
-- Add referrer assignment to coupons. When admin creates a coupon, they
-- can optionally assign it to a specific customer (referrer). When that
-- coupon is used at booking, the assigned referrer earns commission —
-- attribution is guaranteed even without cookies.
--
-- Priority: ref cookie (referred_by_user_id) > coupon's referrer_user_id.
-- Never pays both.

alter table public.coupons
  add column if not exists referrer_user_id uuid references auth.users(id) on delete set null;

create index if not exists coupons_referrer_idx on coupons (referrer_user_id) where referrer_user_id is not null;
