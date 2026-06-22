-- supabase/security_fixes_atomic_2026_06_19.sql
--
-- Race-condition fixes for coupon usage counter + gift card balance redemption.
--
-- Before this migration, the code did SELECT → mutate value → UPDATE. Two
-- concurrent webhooks/checkouts could both pass the limit check and both
-- write, allowing double-spend over max_uses (coupons) or over-spending the
-- balance (gift cards). The atomic UPDATE here uses the WHERE clause to
-- enforce the guard inside a single statement so PostgreSQL row-level lock
-- handles the contention.

-- ───────────────────────────────────────────────────────────────────────
-- Coupon: increment with max_uses guard
-- Returns true if the increment happened (still under max), false if it
-- was blocked (max already reached or coupon not found).
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_coupon_uses_atomic(
  p_code text,
  p_tenant_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id uuid;
BEGIN
  UPDATE coupons
  SET current_uses = current_uses + 1
  WHERE code = p_code
    AND tenant_id = p_tenant_id
    AND (max_uses IS NULL OR current_uses < max_uses)
  RETURNING id INTO v_updated_id;

  RETURN v_updated_id IS NOT NULL;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- Coupon: decrement (floored at 0) — used on cancel/refund.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_coupon_uses_atomic(
  p_code text,
  p_tenant_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupons
  SET current_uses = GREATEST(0, current_uses - 1)
  WHERE code = p_code
    AND tenant_id = p_tenant_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- Gift card: redeem an amount atomically.
-- Returns the new balance (in cents) if the redemption happened, NULL if
-- the card was inactive, expired, or didn't have enough balance.
-- ───────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_gift_card_atomic(
  p_card_id uuid,
  p_amount_cents integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  UPDATE gift_cards
  SET balance_cents = balance_cents - p_amount_cents,
      fully_redeemed_at = CASE
        WHEN balance_cents - p_amount_cents <= 0 THEN NOW()
        ELSE fully_redeemed_at
      END
  WHERE id = p_card_id
    AND is_active = true
    AND balance_cents >= p_amount_cents
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING balance_cents INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_uses_atomic(text, uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.decrement_coupon_uses_atomic(text, uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift_card_atomic(uuid, integer) TO authenticated, service_role, anon;
