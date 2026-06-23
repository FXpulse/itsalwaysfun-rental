"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { awardForPaidBooking } from "@/lib/loyalty";
import { sendBookingConfirmation } from "@/lib/email/scheduled-emails";
import { sendBookingRefunded, sendBookingCancelled } from "@/lib/email/booking-lifecycle";
import { logAuditEvent } from "@/lib/audit";
import { reverseCouponIfPaid } from "@/lib/coupons/counter";
import { z } from "zod";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

const BookingStatusSchema = z.enum([
  "pending_payment",
  "confirmed",
  "delivered",
  "completed",
  "cancelled",
]);

export async function updateBookingStatus(bookingId: string, newStatus: string) {
  const user = await requireAdmin();
  const parsed = BookingStatusSchema.safeParse(newStatus);
  if (!parsed.success) {
    return { error: "Invalid status" };
  }

  const supabase = createAdminClient();

  // Read existing state — we need it for cancel handling AND for deciding
  // whether a transition INTO confirmed/delivered/completed should also
  // promote stripe_payment_status (otherwise the booking-emails cron, which
  // filters on stripe_payment_status="paid", never picks the row up and the
  // 3d reminder + 1d review request silently never fire).
  const { data: existing } = await supabase
    .from("bookings")
    .select("stripe_payment_status, booking_status, notes")
    .eq("id", bookingId)
    .single();

  const updates: { booking_status: string; stripe_payment_status?: string; notes?: string } = {
    booking_status: parsed.data,
  };

  if (parsed.data === "cancelled") {
    if (existing?.stripe_payment_status === "pending") {
      updates.stripe_payment_status = "failed";
    }
    const cancelNote = `[${new Date().toISOString().split("T")[0]}] Cancelled by ${user.email}`;
    updates.notes = existing?.notes ? `${existing.notes}\n${cancelNote}` : cancelNote;
  }

  // Manual confirm path: if admin flips a pending_payment booking to a
  // post-payment status, treat it as paid for downstream automation. The
  // payment_method stays whatever it was — admins who collected cash should
  // still use markAsPaidManually to record the method explicitly.
  const transitioningToPostPayment =
    (parsed.data === "confirmed" || parsed.data === "delivered" || parsed.data === "completed") &&
    existing?.stripe_payment_status === "pending";
  if (transitioningToPostPayment) {
    updates.stripe_payment_status = "paid";
    const note = `[${new Date().toISOString().split("T")[0]}] Marked ${parsed.data} by ${user.email} (manual)`;
    updates.notes = existing?.notes ? `${existing.notes}\n${note}` : note;
  }

  const { error } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", bookingId);

  if (error) return { error: error.message };

  // Cancellation email + coupon reversal when admin sets status to cancelled
  if (parsed.data === "cancelled") {
    try {
      await sendBookingCancelled(bookingId, null);
    } catch (e) {
      console.error("[cancellation email failed, non-fatal]", e);
    }
    // If the booking was paid with a coupon, free that use back up
    await reverseCouponIfPaid(bookingId);
  }

  // Confirmation email + loyalty award on the manual-confirm transition.
  // sendBookingConfirmation is idempotent via booking_emails_sent, and
  // awardForPaidBooking is idempotent via loyalty_events — so it's safe
  // to call even if the booking was already paid before (we just don't
  // duplicate the original Stripe-paid path's work).
  if (transitioningToPostPayment) {
    try {
      await sendBookingConfirmation(bookingId);
    } catch (e) {
      console.error("[manual-confirm: confirmation email failed, non-fatal]", e);
    }
    try {
      await awardForPaidBooking(bookingId);
    } catch (e) {
      console.error("[manual-confirm: loyalty award failed, non-fatal]", e);
    }
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/coupons");
  return { success: true };
}

/** Refund a booking — works for any payment method.
 *
 *  - Stripe payment: calls Stripe Refunds API + marks DB as refunded
 *  - Manual payment (cash/Venmo/Zelle/check/other): just marks DB
 *    (admin returns the money in person/via app, audit logged)
 */
export async function refundBooking(bookingId: string, note: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found" };

  if (booking.stripe_payment_status === "refunded") {
    return { error: "Already refunded" };
  }
  if (booking.stripe_payment_status !== "paid") {
    return { error: "Can only refund paid bookings" };
  }

  let stripeRefundId: string | null = null;
  const isStripePayment =
    booking.payment_method === "stripe" || (!booking.payment_method && booking.stripe_payment_intent_id);

  // Stripe refund first (if applicable)
  if (isStripePayment && booking.stripe_payment_intent_id) {
    if (!isStripeConfigured()) {
      return { error: "Stripe not configured — cannot auto-refund. Refund manually via Stripe Dashboard." };
    }
    try {
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
      });
      stripeRefundId = refund.id;
    } catch (e: any) {
      return { error: `Stripe refund failed: ${e.message}` };
    }
  }

  // Build audit line
  const methodLabel = booking.payment_method || (isStripePayment ? "stripe" : "manual");
  const auditNote = `[${new Date().toISOString().split("T")[0]}] Refunded (${methodLabel}) by ${user.email}${stripeRefundId ? ` — Stripe refund: ${stripeRefundId}` : ""}${note ? ` — ${note}` : ""}`;
  const newNotes = booking.notes ? `${booking.notes}\n${auditNote}` : auditNote;

  const { error } = await supabase
    .from("bookings")
    .update({
      stripe_payment_status: "refunded",
      booking_status: "cancelled",
      notes: newNotes,
    })
    .eq("id", bookingId);

  if (error) return { error: error.message };

  // Refund email (idempotent)
  try {
    await sendBookingRefunded(bookingId, booking.total_amount || 0, methodLabel);
  } catch (e) {
    console.error("[refund email failed, non-fatal]", e);
  }

  // Coupon reversal — paid booking is now refunded, free that use back up
  await reverseCouponIfPaid(bookingId);

  // Audit log
  await logAuditEvent({
    userEmail: user.email || "unknown",
    action: "booking.refunded",
    entityType: "booking",
    entityId: bookingId,
    details: {
      amount_cents: booking.total_amount,
      method: methodLabel,
      stripe_refund_id: stripeRefundId,
      note: note || null,
      customer_email: booking.customer_email,
      event_date: booking.event_date,
    },
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/coupons");
  return {
    success: true,
    stripe_refund_id: stripeRefundId,
    auto_refunded: !!stripeRefundId,
  };
}

/** Restore a cancelled booking. Returns it to pending_payment (or confirmed if was paid). */
export async function restoreBooking(bookingId: string) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("bookings")
    .select("booking_status, stripe_payment_status, notes")
    .eq("id", bookingId)
    .single();

  if (!existing) return { error: "Booking not found" };
  if (existing.booking_status !== "cancelled") {
    return { error: "Only cancelled bookings can be restored" };
  }

  // Decide new status: if was paid, restore to confirmed; otherwise pending_payment
  let newBookingStatus: string;
  let newPaymentStatus: string | undefined;

  if (existing.stripe_payment_status === "paid" || existing.stripe_payment_status === "refunded") {
    newBookingStatus = "confirmed";
  } else {
    newBookingStatus = "pending_payment";
    if (existing.stripe_payment_status === "failed") {
      newPaymentStatus = "pending"; // give it another chance
    }
  }

  const restoreNote = `[${new Date().toISOString().split("T")[0]}] Restored from cancelled by ${user.email}`;
  const newNotes = existing.notes ? `${existing.notes}\n${restoreNote}` : restoreNote;

  const { error } = await supabase
    .from("bookings")
    .update({
      booking_status: newBookingStatus,
      ...(newPaymentStatus && { stripe_payment_status: newPaymentStatus }),
      notes: newNotes,
    })
    .eq("id", bookingId);

  if (error) return { error: error.message };

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true, newStatus: newBookingStatus };
}

export interface CustomerMatch {
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address: string | null;
  bookings_count: number;
  last_event_date: string | null;
}

/** Autocomplete for the manual-booking form. Search the bookings table by
 *  first name / last name / email / phone for the current tenant, group
 *  by lowercase email (the canonical customer key), and return the most
 *  recent details per match. Sorted by frequency so repeat customers
 *  surface first. */
export async function searchBookingCustomers(query: string): Promise<CustomerMatch[]> {
  await requireAdmin();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const supabase = createAdminClient();
  const like = `%${q.replace(/[%_]/g, " ")}%`;
  const { data, error } = await supabase
    .from("bookings")
    .select("customer_first_name, customer_last_name, customer_email, customer_phone, customer_address, event_date, created_at")
    .or(
      `customer_first_name.ilike.${like},customer_last_name.ilike.${like},customer_email.ilike.${like},customer_phone.ilike.${like}`,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  // Group by lowercase email — that's the customer identity. Keep the most
  // recent name/phone/address per identity, plus a frequency count.
  const byEmail = new Map<string, CustomerMatch>();
  for (const row of data as any[]) {
    const emailKey = (row.customer_email || "").toLowerCase().trim();
    if (!emailKey) continue;
    const existing = byEmail.get(emailKey);
    if (existing) {
      existing.bookings_count += 1;
      // Keep last_event_date as the maximum across rows
      if (!existing.last_event_date || (row.event_date && row.event_date > existing.last_event_date)) {
        existing.last_event_date = row.event_date;
      }
    } else {
      byEmail.set(emailKey, {
        email: emailKey,
        first_name: row.customer_first_name || "",
        last_name: row.customer_last_name || "",
        phone: row.customer_phone || null,
        address: row.customer_address || null,
        bookings_count: 1,
        last_event_date: row.event_date || null,
      });
    }
  }

  return [...byEmail.values()]
    .sort((a, b) => {
      // Repeat customers first, then most recent
      if (b.bookings_count !== a.bookings_count) return b.bookings_count - a.bookings_count;
      return (b.last_event_date || "").localeCompare(a.last_event_date || "");
    })
    .slice(0, 12);
}

const PaymentMethodSchema = z.enum(["cash", "venmo", "zelle", "check", "other"]);

/** Mark a booking as manually paid (cash/Venmo/Zelle/check/other). */
export async function markAsPaidManually(
  bookingId: string,
  method: string,
  note: string,
) {
  const user = await requireAdmin();
  const parsed = PaymentMethodSchema.safeParse(method);
  if (!parsed.success) return { error: "Invalid payment method" };

  const supabase = createAdminClient();

  // Build a note line so audit trail is preserved
  const { data: existing } = await supabase
    .from("bookings")
    .select("notes")
    .eq("id", bookingId)
    .single();

  const paidNote = `[${new Date().toISOString().split("T")[0]}] Marked paid (${parsed.data}) by ${user.email}${note ? ` — ${note}` : ""}`;
  const newNotes = existing?.notes ? `${existing.notes}\n${paidNote}` : paidNote;

  const { error } = await supabase
    .from("bookings")
    .update({
      stripe_payment_status: "paid",
      booking_status: "confirmed",
      payment_method: parsed.data,
      notes: newNotes,
    })
    .eq("id", bookingId);

  if (error) return { error: error.message };

  // Loyalty: award points + commission (idempotent — safe if already awarded)
  try {
    await awardForPaidBooking(bookingId);
  } catch (e) {
    console.error("[loyalty award failed, non-fatal]", e);
  }

  // Booking confirmation email (idempotent)
  try {
    await sendBookingConfirmation(bookingId);
  } catch (e) {
    console.error("[booking confirmation email failed, non-fatal]", e);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

/** Admin-triggered re-send of the booking confirmation email. Bypasses the
 *  booking_emails_sent idempotency ledger via force=true so a previously
 *  missed send can actually fire. Use sparingly — clicking this twice
 *  emails the customer twice. */
export async function resendBookingConfirmation(bookingId: string) {
  const user = await requireAdmin();
  if (!bookingId) return { error: "bookingId required" };

  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, stripe_payment_status, customer_email, notes")
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking not found" };
  if (!booking.customer_email) return { error: "Booking has no customer email" };

  try {
    await sendBookingConfirmation(bookingId, { force: true });
  } catch (e: any) {
    return { error: e?.message || "Send failed" };
  }

  // Audit line
  const note = `[${new Date().toISOString().split("T")[0]}] Confirmation re-sent by ${user.email}`;
  const newNotes = booking.notes ? `${booking.notes}\n${note}` : note;
  await supabase.from("bookings").update({ notes: newNotes }).eq("id", bookingId);

  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

export async function updateBookingNotes(bookingId: string, notes: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ notes })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

const NewBookingSchema = z.object({
  product_id: z.string().uuid(),
  customer_first_name: z.string().min(1),
  customer_last_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1),
  customer_address: z.string().optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  total_amount_dollars: z.number().int().min(0),
  payment_method: z.enum(["cash", "venmo", "zelle", "check", "other", "none"]),
  booking_status: z.enum(["pending_payment", "confirmed", "delivered", "completed"]),
  notes: z.string().optional().nullable(),
});

export async function createManualBooking(formData: FormData) {
  const user = await requireAdmin();

  const raw = {
    product_id: String(formData.get("product_id") || ""),
    customer_first_name: String(formData.get("customer_first_name") || ""),
    customer_last_name: String(formData.get("customer_last_name") || ""),
    customer_email: String(formData.get("customer_email") || ""),
    customer_phone: String(formData.get("customer_phone") || ""),
    customer_address: String(formData.get("customer_address") || "") || null,
    event_date: String(formData.get("event_date") || ""),
    start_time: String(formData.get("start_time") || "") || null,
    end_time: String(formData.get("end_time") || "") || null,
    total_amount_dollars: parseInt(String(formData.get("total_amount_dollars") || "0"), 10),
    payment_method: String(formData.get("payment_method") || "none") as any,
    booking_status: String(formData.get("booking_status") || "confirmed") as any,
    notes: String(formData.get("notes") || "") || null,
  };

  const parsed = NewBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = createAdminClient();

  // Get product name
  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", parsed.data.product_id)
    .single();
  if (!product) return { error: "Product not found" };

  // Determine stripe_payment_status from payment_method
  const stripe_payment_status =
    parsed.data.payment_method === "none" ? "pending" : "paid";

  const auditNote = `[${new Date().toISOString().split("T")[0]}] Created manually by ${user.email} (${parsed.data.payment_method})`;
  const finalNotes = parsed.data.notes
    ? `${parsed.data.notes}\n${auditNote}`
    : auditNote;

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      customer_first_name: parsed.data.customer_first_name,
      customer_last_name: parsed.data.customer_last_name,
      customer_email: parsed.data.customer_email,
      customer_phone: parsed.data.customer_phone,
      customer_address: parsed.data.customer_address,
      event_date: parsed.data.event_date,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      product_id: parsed.data.product_id,
      product_name: product.name,
      total_amount: parsed.data.total_amount_dollars * 100,
      stripe_payment_status,
      booking_status: parsed.data.booking_status,
      payment_method: parsed.data.payment_method,
      notes: finalNotes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/bookings");
  return { success: true, booking_id: booking?.id };
}
