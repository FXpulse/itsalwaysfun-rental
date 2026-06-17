/**
 * Booking status state machine tests
 *
 * Verifies the lifecycle: pending_payment → confirmed → delivered → completed,
 * plus the cancelled terminal state. The Stripe webhook handler depends on
 * these transitions being well-formed for its idempotency guard:
 *   "Only flip if current status is pending_payment."
 *
 * Tests are DB-level — they don't simulate the full webhook, but assert the
 * status values + timestamps that the handler reads + writes are consistent.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTestTenant,
  createTestProduct,
  createTestBooking,
  cleanupTenant,
  testClient,
} from "./fixtures";

describe("booking status transitions", () => {
  let tenantId: string;
  let productId: string;
  let bookingId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("bksm");
    const product = await createTestProduct(tenantId);
    productId = product.id;
    bookingId = await createTestBooking(tenantId, productId, {
      booking_status: "pending_payment",
      stripe_payment_status: "pending",
    });
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("starts in pending_payment with a hold_expires_at in the future", async () => {
    const { data } = await testClient()
      .from("bookings")
      .select("booking_status, stripe_payment_status, hold_expires_at")
      .eq("id", bookingId)
      .single();
    const row = data as any;
    expect(row.booking_status).toBe("pending_payment");
    expect(row.stripe_payment_status).toBe("pending");
    expect(new Date(row.hold_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("pending → confirmed flips both status columns", async () => {
    await testClient()
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    const { data } = await testClient()
      .from("bookings")
      .select("booking_status, stripe_payment_status, confirmed_at")
      .eq("id", bookingId)
      .single();
    const row = data as any;
    expect(row.booking_status).toBe("confirmed");
    expect(row.stripe_payment_status).toBe("paid");
    expect(row.confirmed_at).toBeTruthy();
  });

  it("confirmed → delivered preserves payment status", async () => {
    await testClient()
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
      })
      .eq("id", bookingId);

    await testClient()
      .from("bookings")
      .update({ booking_status: "delivered" })
      .eq("id", bookingId);

    const { data } = await testClient()
      .from("bookings")
      .select("booking_status, stripe_payment_status")
      .eq("id", bookingId)
      .single();
    const row = data as any;
    expect(row.booking_status).toBe("delivered");
    // Payment status doesn't roll back when we deliver
    expect(row.stripe_payment_status).toBe("paid");
  });

  it("cancelled is reachable from any state", async () => {
    // From pending
    await testClient()
      .from("bookings")
      .update({ booking_status: "cancelled" })
      .eq("id", bookingId);
    let { data } = await testClient()
      .from("bookings")
      .select("booking_status")
      .eq("id", bookingId)
      .single();
    expect((data as any).booking_status).toBe("cancelled");

    // Create a second booking that goes confirmed → cancelled (refund path)
    const b2 = await createTestBooking(tenantId, productId, {
      booking_status: "confirmed",
      stripe_payment_status: "paid",
      customer_email: "second@test.local",
    });
    await testClient()
      .from("bookings")
      .update({
        booking_status: "cancelled",
        stripe_payment_status: "refunded",
      })
      .eq("id", b2);
    ({ data } = await testClient()
      .from("bookings")
      .select("booking_status, stripe_payment_status")
      .eq("id", b2)
      .single());
    expect((data as any).booking_status).toBe("cancelled");
    expect((data as any).stripe_payment_status).toBe("refunded");
  });

  it("CHECK constraint rejects invalid booking_status values", async () => {
    const { error } = await testClient()
      .from("bookings")
      .update({ booking_status: "wishful_thinking" } as any)
      .eq("id", bookingId);
    expect(error).toBeTruthy();
    // Verify the row didn't change
    const { data } = await testClient()
      .from("bookings")
      .select("booking_status")
      .eq("id", bookingId)
      .single();
    expect((data as any).booking_status).toBe("pending_payment");
  });

  it("CHECK constraint rejects invalid stripe_payment_status values", async () => {
    const { error } = await testClient()
      .from("bookings")
      .update({ stripe_payment_status: "vibes" } as any)
      .eq("id", bookingId);
    expect(error).toBeTruthy();
  });
});

describe("booking webhook idempotency guard pattern", () => {
  let tenantId: string;
  let productId: string;
  let bookingId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("idgrd");
    const product = await createTestProduct(tenantId);
    productId = product.id;
    bookingId = await createTestBooking(tenantId, productId, {
      booking_status: "pending_payment",
      stripe_payment_status: "pending",
    });
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("conditional UPDATE WHERE pending_payment matches a pending row", async () => {
    const { data, error } = await testClient()
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
      })
      .eq("id", bookingId)
      .eq("booking_status", "pending_payment")
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("conditional UPDATE WHERE pending_payment no-ops on already-confirmed row (idempotent webhook retry)", async () => {
    // First call flips the row
    await testClient()
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
      })
      .eq("id", bookingId);

    // Second call — simulating Stripe webhook retry up to 3 days later
    const { data, error } = await testClient()
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
      })
      .eq("id", bookingId)
      .eq("booking_status", "pending_payment") // ← guard
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0); // ← no row matched → no side effects in the webhook handler
  });

  it("conditional UPDATE WHERE pending_payment no-ops on cancelled row (refunded then retry)", async () => {
    // Customer cancelled / refunded
    await testClient()
      .from("bookings")
      .update({
        booking_status: "cancelled",
        stripe_payment_status: "refunded",
      })
      .eq("id", bookingId);

    // Stripe webhook tries to confirm. Guard prevents re-confirming a refunded booking.
    const { data } = await testClient()
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
      })
      .eq("id", bookingId)
      .eq("booking_status", "pending_payment")
      .select("id");
    expect(data).toHaveLength(0);

    // Row still cancelled
    const { data: row } = await testClient()
      .from("bookings")
      .select("booking_status")
      .eq("id", bookingId)
      .single();
    expect((row as any).booking_status).toBe("cancelled");
  });
});
