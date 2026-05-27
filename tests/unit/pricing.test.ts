import { describe, it, expect } from "vitest";
import {
  multiDayTotal,
  additionalDaysCost,
  isWeekendDate,
  multiDayBreakdown,
  applyCoupon,
  ADDITIONAL_DAY_SURCHARGE,
} from "@/lib/pricing";

// ─── Multi-day total ────────────────────────────────────────────────────
describe("multiDayTotal", () => {
  it("returns 0 for invalid day count", () => {
    expect(multiDayTotal(29900, 0)).toBe(0);
    expect(multiDayTotal(29900, -1)).toBe(0);
  });

  it("returns base price for 1 day", () => {
    expect(multiDayTotal(29900, 1)).toBe(29900);
  });

  it("adds 30% surcharge per additional day", () => {
    // 299 + (299 * 0.30 * 1) = 388.70
    expect(multiDayTotal(29900, 2)).toBe(38870);
    // 299 + (299 * 0.30 * 2) = 478.40
    expect(multiDayTotal(29900, 3)).toBe(47840);
    // 299 + (299 * 0.30 * 6) = 837.20 → wait the docstring says 926.90 for 7 days?
    // Doc says: 7 days → $926.90 → 92690 cents
    // Formula: 299 + 299*0.3*6 = 299 + 538.2 = 837.2 = 83720 cents
    // Doc example is wrong; the formula is what matters. Use formula:
    expect(multiDayTotal(29900, 7)).toBe(83720);
  });

  it("handles rounding correctly (no float drift)", () => {
    // 33 * 0.30 = 9.9 → rounded to 10
    // base 33 + (33 * 0.30 * 1) = 33 + 9.9 = 42.9 → rounded to 43
    expect(multiDayTotal(33, 2)).toBe(43);
  });

  it("constant exposed for callers", () => {
    expect(ADDITIONAL_DAY_SURCHARGE).toBe(0.3);
  });
});

describe("additionalDaysCost", () => {
  it("returns 0 for single-day rentals", () => {
    expect(additionalDaysCost(29900, 1)).toBe(0);
    expect(additionalDaysCost(29900, 0)).toBe(0);
  });

  it("matches the surcharge portion of multiDayTotal", () => {
    for (const days of [2, 3, 5, 7]) {
      const surcharge = additionalDaysCost(29900, days);
      const total = multiDayTotal(29900, days);
      expect(total - 29900).toBe(surcharge);
    }
  });
});

// ─── Weekend detection ──────────────────────────────────────────────────
describe("isWeekendDate", () => {
  it("detects Saturdays", () => {
    expect(isWeekendDate("2026-05-30")).toBe(true); // Saturday
    expect(isWeekendDate("2026-06-06")).toBe(true);
  });
  it("detects Sundays", () => {
    expect(isWeekendDate("2026-05-31")).toBe(true); // Sunday
    expect(isWeekendDate("2026-06-07")).toBe(true);
  });
  it("rejects weekdays", () => {
    expect(isWeekendDate("2026-05-25")).toBe(false); // Monday
    expect(isWeekendDate("2026-05-28")).toBe(false); // Thursday
    expect(isWeekendDate("2026-05-29")).toBe(false); // Friday
  });
});

// ─── Multi-day breakdown (with weekend pricing) ─────────────────────────
describe("multiDayBreakdown", () => {
  it("single weekday, no weekend rate", () => {
    const r = multiDayBreakdown(["2026-05-25"], 29900, null);
    expect(r.total).toBe(29900);
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0].isFirstDay).toBe(true);
    expect(r.breakdown[0].isWeekend).toBe(false);
    expect(r.breakdown[0].appliedPriceCents).toBe(29900);
  });

  it("3 weekdays — day 2+ at 30% surcharge", () => {
    const r = multiDayBreakdown(
      ["2026-05-25", "2026-05-26", "2026-05-27"],
      10000,
      null,
    );
    // 10000 + 3000 + 3000 = 16000
    expect(r.total).toBe(16000);
    expect(r.breakdown[0].appliedPriceCents).toBe(10000);
    expect(r.breakdown[1].appliedPriceCents).toBe(3000);
    expect(r.breakdown[2].appliedPriceCents).toBe(3000);
  });

  it("weekend rate applies per-day when set", () => {
    // Sat (weekend rate 12000) + Sun (weekend) + Mon (weekday 10000)
    const r = multiDayBreakdown(
      ["2026-05-30", "2026-05-31", "2026-06-01"],
      10000, // weekday
      12000, // weekend
    );
    // Sat day 1: 12000 (weekend base, no surcharge)
    // Sun day 2: 12000 * 0.30 = 3600 (weekend base, surcharge)
    // Mon day 3: 10000 * 0.30 = 3000 (weekday base, surcharge)
    expect(r.breakdown[0].appliedPriceCents).toBe(12000);
    expect(r.breakdown[1].appliedPriceCents).toBe(3600);
    expect(r.breakdown[2].appliedPriceCents).toBe(3000);
    expect(r.total).toBe(18600);
  });

  it("weekend rate of 0 or null falls back to weekday for all days", () => {
    const r1 = multiDayBreakdown(["2026-05-30"], 10000, 0);
    expect(r1.breakdown[0].appliedPriceCents).toBe(10000);
    const r2 = multiDayBreakdown(["2026-05-30"], 10000, undefined);
    expect(r2.breakdown[0].appliedPriceCents).toBe(10000);
  });
});

// ─── Coupons ────────────────────────────────────────────────────────────
describe("applyCoupon — percent", () => {
  it("applies a 10% discount", () => {
    const r = applyCoupon(10000, { discount_type: "percent", discount_value: 10 });
    expect(r.discount).toBe(1000);
    expect(r.total).toBe(9000);
  });

  it("applies 100% (DONOR-style)", () => {
    const r = applyCoupon(10000, { discount_type: "percent", discount_value: 100 });
    expect(r.discount).toBe(10000);
    expect(r.total).toBe(0);
  });

  it("clamps discount above 100%", () => {
    const r = applyCoupon(10000, { discount_type: "percent", discount_value: 150 });
    expect(r.total).toBe(0);
  });

  it("clamps discount below 0%", () => {
    const r = applyCoupon(10000, { discount_type: "percent", discount_value: -5 });
    expect(r.discount).toBe(0);
    expect(r.total).toBe(10000);
  });

  it("rounds to nearest cent", () => {
    // 33 * 0.10 = 3.3 → round to 3
    const r = applyCoupon(33, { discount_type: "percent", discount_value: 10 });
    expect(r.discount).toBe(3);
    expect(r.total).toBe(30);
  });
});

describe("applyCoupon — fixed", () => {
  it("subtracts the fixed amount", () => {
    const r = applyCoupon(10000, { discount_type: "fixed", discount_value: 2500 });
    expect(r.discount).toBe(2500);
    expect(r.total).toBe(7500);
  });

  it("never overdiscounts (caps at subtotal)", () => {
    const r = applyCoupon(1000, { discount_type: "fixed", discount_value: 5000 });
    expect(r.discount).toBe(1000);
    expect(r.total).toBe(0);
  });

  it("ignores negative discount values", () => {
    const r = applyCoupon(10000, { discount_type: "fixed", discount_value: -100 });
    expect(r.discount).toBe(0);
    expect(r.total).toBe(10000);
  });
});

describe("applyCoupon — overnight_free", () => {
  it("rejects on single-day rental", () => {
    const r = applyCoupon(
      10000,
      { discount_type: "overnight_free", discount_value: 0 },
      { isTwoDayRental: false, overnightSurchargeCents: 3000 },
    );
    expect(r.discount).toBe(0);
    expect(r.total).toBe(10000);
    expect(r.rejected).toMatch(/2-day/);
  });

  it("rejects on 3+ day rental", () => {
    const r = applyCoupon(
      20000,
      { discount_type: "overnight_free", discount_value: 0 },
      { isTwoDayRental: false, overnightSurchargeCents: 6000 },
    );
    expect(r.rejected).toBeDefined();
  });

  it("applies day-2 surcharge as discount on exactly-2-day rental", () => {
    const r = applyCoupon(
      13000, // base 10000 + 3000 surcharge
      { discount_type: "overnight_free", discount_value: 0 },
      { isTwoDayRental: true, overnightSurchargeCents: 3000 },
    );
    expect(r.discount).toBe(3000);
    expect(r.total).toBe(10000);
  });

  it("rejected field absent on successful apply", () => {
    const r = applyCoupon(
      13000,
      { discount_type: "overnight_free", discount_value: 0 },
      { isTwoDayRental: true, overnightSurchargeCents: 3000 },
    );
    expect(r.rejected).toBeUndefined();
  });
});
