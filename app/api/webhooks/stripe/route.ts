// POST /api/webhooks/stripe
// Handles Stripe webhook events: payment_intent.succeeded, payment_intent.payment_failed.
//
// Setup steps:
// 1. Deploy to Vercel
// 2. dashboard.stripe.com → Developers → Webhooks → + Add endpoint
//    URL: https://YOUR_VERCEL_URL.vercel.app/api/webhooks/stripe
//    Events: payment_intent.succeeded, payment_intent.payment_failed
//    Copy "Signing secret" → set STRIPE_WEBHOOK_SECRET in Vercel env

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addContactNote, upsertContact, addContactTags } from "@/lib/ghl/client";
import { awardForPaidBooking } from "@/lib/loyalty";
import { sendBookingConfirmation } from "@/lib/email/scheduled-emails";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = headers().get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // ── PAYMENT SUCCEEDED ───────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.booking_id;

    if (!bookingId) {
      return NextResponse.json({ received: true, note: "no booking_id in metadata" });
    }

    // Update booking → confirmed + paid
    const { data: booking, error } = await supabase
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
        hold_expires_at: null,
      })
      .eq("id", bookingId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Booking update failed", details: error.message },
        { status: 500 }
      );
    }

    // Best-effort GHL sync (don't fail the webhook if GHL fails)
    try {
      const { contact } = await upsertContact({
        firstName: booking.customer_first_name,
        lastName: booking.customer_last_name,
        email: booking.customer_email,
        phone: booking.customer_phone || undefined,
        address: booking.customer_address || undefined,
        tags: ["paid-customer", "prospector-rental-customer"],
      });

      if (contact?.id) {
        await addContactTags(contact.id, ["paid-customer"]);
        await addContactNote(
          contact.id,
          `📅 Booking confirmed\n` +
            `Product: ${booking.product_name}\n` +
            `Date: ${booking.event_date}\n` +
            (booking.start_time ? `Time: ${booking.start_time} – ${booking.end_time || "?"}\n` : "") +
            `Amount paid: $${(booking.total_amount / 100).toFixed(2)}\n` +
            `Stripe PI: ${pi.id}\n` +
            `Booking ID: ${booking.id}`
        );
      }
    } catch (e) {
      console.error("[GHL sync failed, non-fatal]", e);
    }

    // Loyalty: award points to the buyer + commission to referrer (if any)
    try {
      await awardForPaidBooking(bookingId);
    } catch (e) {
      console.error("[loyalty award failed, non-fatal]", e);
    }

    // Send booking confirmation email (idempotent via booking_emails_sent)
    try {
      await sendBookingConfirmation(bookingId);
    } catch (e) {
      console.error("[booking confirmation email failed, non-fatal]", e);
    }

    return NextResponse.json({ received: true, booking_id: bookingId, status: "confirmed" });
  }

  // ── PAYMENT FAILED ──────────────────────────────────────────────
  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const bookingId = pi.metadata?.booking_id;
    if (!bookingId) {
      return NextResponse.json({ received: true });
    }

    await supabase
      .from("bookings")
      .update({
        booking_status: "cancelled",
        stripe_payment_status: "failed",
      })
      .eq("id", bookingId);

    return NextResponse.json({ received: true, booking_id: bookingId, status: "cancelled" });
  }

  // ── CHARGE REFUNDED ─────────────────────────────────────────────
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (charge.payment_intent && typeof charge.payment_intent === "string") {
      await supabase
        .from("bookings")
        .update({ stripe_payment_status: "refunded", booking_status: "cancelled" })
        .eq("stripe_payment_intent_id", charge.payment_intent);
    }
    return NextResponse.json({ received: true, type: "refund" });
  }

  // Other events — ack but ignore
  return NextResponse.json({ received: true, event_type: event.type });
}
