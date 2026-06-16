/**
 * Booking email idempotency tests
 *
 * El bug del 2026-06-15: quote-converted bookings no recibían el confirmation
 * email porque el cliente JS (markQuoteConverted) flipeaba el state antes del
 * webhook, y el webhook tenía guardia `.eq("stripe_payment_status", "pending")`
 * que ya no matcheaba.
 *
 * Estos tests garantizan que el fix de defense-in-depth se mantiene:
 *   - sendBookingConfirmation NUNCA duplica el email aunque se llame N veces
 *   - El ledger booking_emails_sent es la fuente de verdad para idempotencia
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestTenant, createTestProduct, createTestBooking, cleanupTenant, getEmailsSent } from "./fixtures";

// Mock toda la pila de email para que no haga round-trips reales a Resend
// + no requiera tenant email templates en DB.
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true, id: "resend_mock_id" }),
  isEmailConfigured: () => true,
}));

vi.mock("@/lib/email/send-template", () => ({
  sendTemplated: vi.fn().mockResolvedValue({ ok: true, id: "resend_mock_id" }),
}));

vi.mock("@/lib/email/tenant-email", () => ({
  getTenantEmailConfig: vi.fn().mockResolvedValue({
    from: "test@example.com",
    replyTo: "reply@example.com",
  }),
}));

vi.mock("@/lib/sms/send", () => ({
  sendSms: vi.fn().mockResolvedValue({ ok: true }),
  isSmsConfigured: () => false, // off por simpleza en tests
}));

describe("sendBookingConfirmation idempotency", () => {
  let tenantId: string;
  let bookingId: string;

  beforeEach(async () => {
    tenantId = await createTestTenant("idemp");
    const product = await createTestProduct(tenantId);
    bookingId = await createTestBooking(tenantId, product.id, {
      stripe_payment_status: "paid",
      booking_status: "confirmed",
    });
  });

  afterEach(async () => {
    await cleanupTenant(tenantId);
  });

  it("first call sends the email", async () => {
    const { sendBookingConfirmation } = await import("@/lib/email/scheduled-emails");
    await sendBookingConfirmation(bookingId);

    const count = await getEmailsSent(bookingId, "booking_confirmation");
    expect(count).toBe(1);
  });

  it("second call is a no-op (idempotency via ledger)", async () => {
    const { sendBookingConfirmation } = await import("@/lib/email/scheduled-emails");
    await sendBookingConfirmation(bookingId);
    await sendBookingConfirmation(bookingId); // duplicate

    const count = await getEmailsSent(bookingId, "booking_confirmation");
    expect(count).toBe(1); // still 1, not 2
  });

  it("five concurrent calls only record one send (race-safe)", async () => {
    const { sendBookingConfirmation } = await import("@/lib/email/scheduled-emails");
    await Promise.all([
      sendBookingConfirmation(bookingId),
      sendBookingConfirmation(bookingId),
      sendBookingConfirmation(bookingId),
      sendBookingConfirmation(bookingId),
      sendBookingConfirmation(bookingId),
    ]);

    const count = await getEmailsSent(bookingId, "booking_confirmation");
    // Note: dependiendo del row-level locking, esto podría dar 1 o algo mayor
    // si la idempotencia se basa solo en check-then-insert sin unique constraint.
    // El test documenta cuál es el contrato actual.
    expect(count).toBeLessThanOrEqual(1);
  });
});
