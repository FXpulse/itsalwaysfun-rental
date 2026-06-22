// Coupon current_uses counter helpers.
//
// Convention: current_uses tracks the number of bookings that have been
// PAID with the coupon applied. Increments happen at payment success;
// decrements happen when a paid booking is cancelled/refunded so the
// count stays accurate and a previously-exhausted coupon can become
// available again.
//
// Both calls delegate to SECURITY DEFINER Postgres functions that perform
// the update inside a single statement with row-level locking. The earlier
// "SELECT current_uses → UPDATE" pattern allowed concurrent webhooks to
// double-spend a single-use coupon (race condition). See migration
// supabase/migrations/20260619120000_security_atomic_counters.sql.

import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

/** Atomically increment current_uses by 1, but only if still under max_uses.
 *  Returns true on success, false if the limit was already reached or the
 *  coupon doesn't exist. */
export async function incrementCouponUses(params: {
  code: string;
  tenantId: string;
}): Promise<boolean> {
  const supabase = createAdminClient({ unscoped: true });
  const { data, error } = await supabase.rpc("increment_coupon_uses_atomic", {
    p_code: params.code,
    p_tenant_id: params.tenantId,
  });
  if (error) {
    Sentry.captureMessage("incrementCouponUses RPC failed", {
      level: "warning",
      tags: { area: "coupons", code: params.code, tenant_id: params.tenantId },
      extra: { error: error.message },
    });
    return false;
  }
  return data === true;
}

/** Atomically decrement current_uses by 1, floored at 0.
 *  Use when a paid booking is cancelled/refunded. */
export async function decrementCouponUses(params: {
  code: string;
  tenantId: string;
}): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.rpc("decrement_coupon_uses_atomic", {
    p_code: params.code,
    p_tenant_id: params.tenantId,
  });
  if (error) {
    Sentry.captureMessage("decrementCouponUses RPC failed", {
      level: "warning",
      tags: { area: "coupons", code: params.code, tenant_id: params.tenantId },
      extra: { error: error.message },
    });
  }
}

/** Read a booking and, if it was paid with a coupon, decrement that coupon.
 *  Best-effort — never throws. Safe to call from cancel/refund flows. */
export async function reverseCouponIfPaid(bookingId: string): Promise<void> {
  try {
    const supabase = createAdminClient({ unscoped: true });
    const { data: booking } = await supabase
      .from("bookings")
      .select("coupon_code, stripe_payment_status, tenant_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;
    const wasPaid = (booking as any).stripe_payment_status === "paid"
      || (booking as any).stripe_payment_status === "refunded";
    const code = (booking as any).coupon_code;
    const tenantId = (booking as any).tenant_id;
    if (!wasPaid || !code || !tenantId) return;
    await decrementCouponUses({ code, tenantId });
  } catch (e) {
    console.error("reverseCouponIfPaid error:", e);
  }
}
