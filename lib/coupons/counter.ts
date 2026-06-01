// Coupon current_uses counter helpers.
//
// Convention: current_uses tracks the number of bookings that have been
// PAID with the coupon applied. Increments happen at payment success;
// decrements happen when a paid booking is cancelled/refunded so the
// count stays accurate and a previously-exhausted coupon can become
// available again.

import { createAdminClient } from "@/lib/supabase/admin";

/** Increment current_uses for a coupon by 1 (no-op if coupon not found). */
export async function incrementCouponUses(params: {
  code: string;
  tenantId: string;
}): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: c } = await supabase
    .from("coupons")
    .select("current_uses")
    .eq("code", params.code)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (!c) return;
  await supabase
    .from("coupons")
    .update({ current_uses: ((c as any).current_uses || 0) + 1 })
    .eq("code", params.code)
    .eq("tenant_id", params.tenantId);
}

/** Decrement current_uses for a coupon by 1, floored at 0.
 *  Use when a paid booking is cancelled/refunded. */
export async function decrementCouponUses(params: {
  code: string;
  tenantId: string;
}): Promise<void> {
  const supabase = createAdminClient({ unscoped: true });
  const { data: c } = await supabase
    .from("coupons")
    .select("current_uses")
    .eq("code", params.code)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (!c) return;
  const current = (c as any).current_uses || 0;
  if (current <= 0) return; // already at floor
  await supabase
    .from("coupons")
    .update({ current_uses: current - 1 })
    .eq("code", params.code)
    .eq("tenant_id", params.tenantId);
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
