/**
 * Atomic counter race-condition tests
 *
 * Migration 20260619120000_security_atomic_counters.sql introduced
 * increment_coupon_uses_atomic + redeem_gift_card_atomic to fix two
 * check-then-update races flagged by the 2026-06-19 security audit:
 *
 *   H3. Coupon double-spend — two concurrent webhooks both saw uses<max
 *       and both incremented, allowing a single-use coupon to be redeemed
 *       on TWO bookings.
 *   H4. Gift card balance race — two concurrent checkouts both saw the
 *       same balance and both deducted the full amount, draining the
 *       card past zero.
 *
 * These tests fire N parallel calls against the same row and assert
 * that the WHERE clause guard in the SECURITY DEFINER function rejects
 * the over-quota / over-balance operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  testClient,
  createTestTenant,
  cleanupTenant,
  createTestCoupon,
  createTestGiftCard,
  getCouponUses,
  getGiftCardBalance,
} from "./fixtures";

describe("increment_coupon_uses_atomic", () => {
  let tenantId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("coupon-race");
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("increments once when called once under the cap", async () => {
    const supabase = testClient();
    const { code } = await createTestCoupon(tenantId, { max_uses: 3, current_uses: 0 });

    const { data: ok, error } = await supabase.rpc("increment_coupon_uses_atomic", {
      p_code: code,
      p_tenant_id: tenantId,
    });

    expect(error).toBeNull();
    expect(ok).toBe(true);

    const { data: row } = await supabase
      .from("coupons")
      .select("current_uses")
      .eq("code", code)
      .single();
    expect(row?.current_uses).toBe(1);
  });

  it("returns false when already at max_uses", async () => {
    const supabase = testClient();
    const { code, id } = await createTestCoupon(tenantId, {
      max_uses: 2,
      current_uses: 2,
    });

    const { data: ok } = await supabase.rpc("increment_coupon_uses_atomic", {
      p_code: code,
      p_tenant_id: tenantId,
    });

    expect(ok).toBe(false);
    expect(await getCouponUses(id)).toBe(2);
  });

  it("returns false for unknown code", async () => {
    const supabase = testClient();
    const { data: ok } = await supabase.rpc("increment_coupon_uses_atomic", {
      p_code: "DOES-NOT-EXIST",
      p_tenant_id: tenantId,
    });
    expect(ok).toBe(false);
  });

  it("returns false when code belongs to another tenant", async () => {
    const supabase = testClient();
    const otherTenantId = await createTestTenant("coupon-race-other");
    try {
      const { code, id } = await createTestCoupon(tenantId, { max_uses: 5 });

      const { data: ok } = await supabase.rpc("increment_coupon_uses_atomic", {
        p_code: code,
        p_tenant_id: otherTenantId,
      });
      expect(ok).toBe(false);

      // And the original tenant's count is untouched.
      expect(await getCouponUses(id)).toBe(0);
    } finally {
      await cleanupTenant(otherTenantId);
    }
  });

  it("under concurrent fire, NEVER exceeds max_uses (the H3 race)", async () => {
    const supabase = testClient();
    const MAX = 3;
    const PARALLEL = 10;
    const { code, id } = await createTestCoupon(tenantId, {
      max_uses: MAX,
      current_uses: 0,
    });

    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        supabase.rpc("increment_coupon_uses_atomic", {
          p_code: code,
          p_tenant_id: tenantId,
        }),
      ),
    );

    const successes = results.filter((r) => r.data === true).length;
    const final = await getCouponUses(id);

    // The contract: exactly MAX successes, exactly MAX final count.
    expect(successes).toBe(MAX);
    expect(final).toBe(MAX);
  });

  it("with no max_uses (NULL), all concurrent calls succeed", async () => {
    const supabase = testClient();
    const PARALLEL = 8;
    const { code, id } = await createTestCoupon(tenantId, {
      max_uses: null,
      current_uses: 0,
    });

    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        supabase.rpc("increment_coupon_uses_atomic", {
          p_code: code,
          p_tenant_id: tenantId,
        }),
      ),
    );

    expect(results.every((r) => r.data === true)).toBe(true);
    expect(await getCouponUses(id)).toBe(PARALLEL);
  });
});

describe("decrement_coupon_uses_atomic", () => {
  let tenantId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("coupon-dec");
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("decrements one", async () => {
    const supabase = testClient();
    const { code, id } = await createTestCoupon(tenantId, { current_uses: 3 });

    await supabase.rpc("decrement_coupon_uses_atomic", {
      p_code: code,
      p_tenant_id: tenantId,
    });

    expect(await getCouponUses(id)).toBe(2);
  });

  it("floors at zero — never goes negative", async () => {
    const supabase = testClient();
    const { code, id } = await createTestCoupon(tenantId, { current_uses: 0 });

    await supabase.rpc("decrement_coupon_uses_atomic", {
      p_code: code,
      p_tenant_id: tenantId,
    });
    await supabase.rpc("decrement_coupon_uses_atomic", {
      p_code: code,
      p_tenant_id: tenantId,
    });

    expect(await getCouponUses(id)).toBe(0);
  });
});

describe("redeem_gift_card_atomic", () => {
  let tenantId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("gift-race");
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("redeems a partial amount and returns new balance", async () => {
    const supabase = testClient();
    const { id } = await createTestGiftCard(tenantId, { balance_cents: 10000 });

    const { data: newBal, error } = await supabase.rpc("redeem_gift_card_atomic", {
      p_card_id: id,
      p_amount_cents: 3500,
    });

    expect(error).toBeNull();
    expect(newBal).toBe(6500);
    expect(await getGiftCardBalance(id)).toBe(6500);
  });

  it("redeems the exact balance and marks the card fully redeemed", async () => {
    const supabase = testClient();
    const { id } = await createTestGiftCard(tenantId, { balance_cents: 5000 });

    const { data: newBal } = await supabase.rpc("redeem_gift_card_atomic", {
      p_card_id: id,
      p_amount_cents: 5000,
    });

    expect(newBal).toBe(0);
    expect(await getGiftCardBalance(id)).toBe(0);

    const { data: row } = await supabase
      .from("gift_cards")
      .select("fully_redeemed_at")
      .eq("id", id)
      .single();
    expect(row?.fully_redeemed_at).not.toBeNull();
  });

  it("returns NULL when amount exceeds balance (no partial deduction)", async () => {
    const supabase = testClient();
    const { id } = await createTestGiftCard(tenantId, { balance_cents: 1000 });

    const { data: newBal } = await supabase.rpc("redeem_gift_card_atomic", {
      p_card_id: id,
      p_amount_cents: 1500,
    });

    expect(newBal).toBeNull();
    expect(await getGiftCardBalance(id)).toBe(1000);
  });

  it("returns NULL when card is inactive", async () => {
    const supabase = testClient();
    const { id } = await createTestGiftCard(tenantId, {
      balance_cents: 5000,
      is_active: false,
    });

    const { data: newBal } = await supabase.rpc("redeem_gift_card_atomic", {
      p_card_id: id,
      p_amount_cents: 1000,
    });
    expect(newBal).toBeNull();
    expect(await getGiftCardBalance(id)).toBe(5000);
  });

  it("returns NULL when card is expired", async () => {
    const supabase = testClient();
    const past = new Date(Date.now() - 86400_000).toISOString();
    const { id } = await createTestGiftCard(tenantId, {
      balance_cents: 5000,
      expires_at: past,
    });

    const { data: newBal } = await supabase.rpc("redeem_gift_card_atomic", {
      p_card_id: id,
      p_amount_cents: 1000,
    });
    expect(newBal).toBeNull();
  });

  it("under concurrent fire, balance NEVER goes negative (the H4 race)", async () => {
    const supabase = testClient();
    const BAL = 1000;
    const AMOUNT = 400;
    // Card has $10, each attempt deducts $4 → max 2 successes (2×4 = 8, then 2 left)
    const PARALLEL = 10;
    const { id } = await createTestGiftCard(tenantId, { balance_cents: BAL });

    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        supabase.rpc("redeem_gift_card_atomic", {
          p_card_id: id,
          p_amount_cents: AMOUNT,
        }),
      ),
    );

    const successes = results.filter((r) => r.data !== null && r.error === null).length;
    const final = await getGiftCardBalance(id);

    // Contract: exactly 2 successes (floor(BAL / AMOUNT)). Final balance never
    // negative; equals BAL - successes * AMOUNT.
    expect(successes).toBe(Math.floor(BAL / AMOUNT));
    expect(final).toBe(BAL - successes * AMOUNT);
    expect(final).toBeGreaterThanOrEqual(0);
  });
});
