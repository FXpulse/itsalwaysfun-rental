// Pricing calculations — multi-day surcharge + coupon discount.
// Used both in API and UI so customer + server agree on totals.

/** Multi-day total: 1st day full price, each additional day +30% surcharge.
 *  Examples for $299 base:
 *    1 day → $299.00
 *    2 days → $388.70  (299 + 89.70)
 *    3 days → $478.40
 *    7 days → $926.90
 */
export const ADDITIONAL_DAY_SURCHARGE = 0.30;

export function multiDayTotal(pricePerDayCents: number, days: number): number {
  if (days < 1) return 0;
  if (days === 1) return pricePerDayCents;
  const surcharge = pricePerDayCents * ADDITIONAL_DAY_SURCHARGE * (days - 1);
  return Math.round(pricePerDayCents + surcharge);
}

export function additionalDaysCost(pricePerDayCents: number, days: number): number {
  if (days <= 1) return 0;
  return Math.round(pricePerDayCents * ADDITIONAL_DAY_SURCHARGE * (days - 1));
}

/** Apply coupon discount to a total. Returns new total + applied discount (cents). */
export function applyCoupon(
  subtotalCents: number,
  coupon: { discount_type: "percent" | "fixed"; discount_value: number },
): { total: number; discount: number } {
  if (coupon.discount_type === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.discount_value));
    const discount = Math.round(subtotalCents * (pct / 100));
    return { total: Math.max(0, subtotalCents - discount), discount };
  } else {
    // fixed (cents)
    const discount = Math.min(subtotalCents, Math.max(0, coupon.discount_value));
    return { total: Math.max(0, subtotalCents - discount), discount };
  }
}
