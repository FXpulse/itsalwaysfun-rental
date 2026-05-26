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

/** True if YYYY-MM-DD falls on Saturday or Sunday. */
export function isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6;
}

export interface DayBreakdown {
  date: string;
  isWeekend: boolean;
  basePriceCents: number;       // weekday or weekend price
  appliedPriceCents: number;    // after surcharge for day 2+
  isFirstDay: boolean;
}

/** Compute per-day pricing for a multi-day rental, optionally honoring weekend rate.
 *
 *  Rule: each day uses its own base (weekend_price if Sat/Sun else weekday_price).
 *  Day 1 = 100% of that day's base; Day 2+ = 30% surcharge of that day's base.
 *
 *  When weekendPriceCents is null/undefined, weekday price is used for ALL days
 *  (backwards-compatible with the original formula). */
export function multiDayBreakdown(
  dates: string[],
  weekdayPriceCents: number,
  weekendPriceCents: number | null | undefined,
): { breakdown: DayBreakdown[]; total: number } {
  const useWeekend =
    typeof weekendPriceCents === "number" && weekendPriceCents > 0;
  const breakdown: DayBreakdown[] = dates.map((date, i) => {
    const isWeekend = isWeekendDate(date);
    const base = useWeekend && isWeekend ? weekendPriceCents! : weekdayPriceCents;
    const isFirstDay = i === 0;
    const applied = isFirstDay ? base : Math.round(base * ADDITIONAL_DAY_SURCHARGE);
    return {
      date,
      isWeekend,
      basePriceCents: base,
      appliedPriceCents: applied,
      isFirstDay,
    };
  });
  const total = breakdown.reduce((s, d) => s + d.appliedPriceCents, 0);
  return { breakdown, total };
}

/** Apply coupon discount to a total. Returns new total + applied discount (cents).
 *  For 'overnight_free' type, pass the day-2 surcharge as the `overnightSurchargeCents`
 *  argument — the coupon is only valid when that's > 0 (i.e. rental is multi-day).
 *  For 'overnight_free' applied to a single-day rental, returns no discount. */
export function applyCoupon(
  subtotalCents: number,
  coupon: {
    discount_type: "percent" | "fixed" | "overnight_free";
    discount_value: number;
  },
  context?: {
    overnightSurchargeCents?: number;  // day-2 surcharge from multiDayBreakdown
    isTwoDayRental?: boolean;          // overnight = exactly 2 days
  },
): { total: number; discount: number; rejected?: string } {
  if (coupon.discount_type === "percent") {
    const pct = Math.max(0, Math.min(100, coupon.discount_value));
    const discount = Math.round(subtotalCents * (pct / 100));
    return { total: Math.max(0, subtotalCents - discount), discount };
  }
  if (coupon.discount_type === "fixed") {
    const discount = Math.min(subtotalCents, Math.max(0, coupon.discount_value));
    return { total: Math.max(0, subtotalCents - discount), discount };
  }
  // overnight_free — only valid on exactly 2-day rentals
  if (coupon.discount_type === "overnight_free") {
    const isTwoDay = context?.isTwoDayRental ?? false;
    if (!isTwoDay) {
      return {
        total: subtotalCents,
        discount: 0,
        rejected: "This coupon only applies to 2-day (overnight) rentals.",
      };
    }
    const surcharge = Math.max(0, context?.overnightSurchargeCents || 0);
    const discount = Math.min(subtotalCents, surcharge);
    return { total: Math.max(0, subtotalCents - discount), discount };
  }
  return { total: subtotalCents, discount: 0 };
}
