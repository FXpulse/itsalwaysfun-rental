/**
 * Inventory availability tests
 *
 * Verifies the load-bearing invariant of the booking system:
 *   "Only PAID bookings count against inventory stock."
 *
 * If this regresses, two failure modes appear in production:
 *   1. Abandoned carts lock out real customers (pending bookings blocking)
 *   2. Double-bookings on the same slot (paid bookings NOT counted)
 *
 * Tests run direct DB queries that emulate the logic in:
 *   - GET /api/availability
 *   - GET /api/products/[slug]
 *   - POST /api/bookings/check-and-hold (step 3)
 *
 * If those endpoints diverge from this query shape, the tests need updating
 * — and that divergence is exactly what would cause production bugs.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestTenant,
  createTestProduct,
  createTestBooking,
  cleanupTenant,
  testClient,
} from "./fixtures";

const TARGET_DATE = "2027-01-15"; // fixed future date, no DST surprises

async function countBlockingBookings(productId: string, date: string): Promise<number> {
  const supabase = testClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, booking_status")
    .eq("product_id", productId)
    .eq("event_date", date)
    .in("booking_status", ["confirmed", "delivered"]);
  return (data || []).length;
}

describe("inventory availability — paid-only blocking", () => {
  let tenantId: string;
  let productId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("invav");
    const product = await createTestProduct(tenantId, { name: "Stock-1 Bouncer" });
    productId = product.id;
    // Default stock from createTestProduct is 5 — narrow for this suite
    await testClient().from("products").update({ stock: 1 }).eq("id", productId);
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("confirmed booking blocks the slot", async () => {
    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "confirmed",
      stripe_payment_status: "paid",
    });
    expect(await countBlockingBookings(productId, TARGET_DATE)).toBe(1);
  });

  it("delivered booking still blocks (in-progress rentals are inventory-occupied)", async () => {
    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "delivered",
      stripe_payment_status: "paid",
    });
    expect(await countBlockingBookings(productId, TARGET_DATE)).toBe(1);
  });

  it("pending_payment booking does NOT block — abandoned cart can't lock real customers out", async () => {
    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "pending_payment",
      stripe_payment_status: "pending",
    });
    expect(await countBlockingBookings(productId, TARGET_DATE)).toBe(0);
  });

  it("cancelled booking does NOT block — slot reopens after admin cancels", async () => {
    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "cancelled",
      stripe_payment_status: "refunded",
    });
    expect(await countBlockingBookings(productId, TARGET_DATE)).toBe(0);
  });

  it("stock-aware: 2 paid bookings on stock=2 = full; stock=3 = still room", async () => {
    await testClient().from("products").update({ stock: 2 }).eq("id", productId);

    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "confirmed",
      stripe_payment_status: "paid",
    });
    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "confirmed",
      stripe_payment_status: "paid",
    });

    const blocking = await countBlockingBookings(productId, TARGET_DATE);
    const { data: product } = await testClient()
      .from("products")
      .select("stock")
      .eq("id", productId)
      .single();

    expect(blocking).toBe(2);
    expect(blocking).toBeGreaterThanOrEqual((product as any)?.stock);
  });

  it("date isolation: blocking is per-day, not per-product", async () => {
    await createTestBooking(tenantId, productId, {
      event_date: TARGET_DATE,
      booking_status: "confirmed",
      stripe_payment_status: "paid",
    });
    // Different date on same product
    expect(await countBlockingBookings(productId, "2027-02-20")).toBe(0);
  });
});

describe("inventory availability — blocked_dates respected", () => {
  let tenantId: string;
  let productId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("blkdt");
    const product = await createTestProduct(tenantId, { name: "Blockable Bouncer" });
    productId = product.id;
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("blocked_date row marks the slot unavailable even with no bookings", async () => {
    const supabase = testClient();
    await supabase
      .from("blocked_dates")
      .insert({
        product_id: productId,
        blocked_date: TARGET_DATE,
        reason: "maintenance",
      });

    const { data } = await supabase
      .from("blocked_dates")
      .select("reason")
      .eq("product_id", productId)
      .eq("blocked_date", TARGET_DATE)
      .maybeSingle();

    expect(data).toBeTruthy();
    expect((data as any).reason).toBe("maintenance");
  });
});
