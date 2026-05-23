// POST /api/bookings/check-and-hold
// Body: { product_slug | product_id, event_date, start_time?, end_time?,
//         customer: { first_name, last_name, email, phone?, address? } }
//
// Flow:
//   1. Validate availability for product+date
//   2. Create booking with status="pending_payment", hold_expires_at = now + 15min
//   3. Create Stripe Payment Intent for the FULL price (100% upfront, no deposit)
//   4. Return { booking_id, client_secret, amount }
//
// If Stripe is not configured: returns booking but no client_secret
// (allows testing the hold flow before Stripe keys are present).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

const HOLD_MINUTES = 15;

const BodySchema = z
  .object({
    product_slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    product_id: z.string().uuid().optional(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    customer: z.object({
      first_name: z.string().min(1).max(100),
      last_name: z.string().min(1).max(100),
      email: z.string().email(),
      phone: z.string().max(40).optional(),
      address: z.string().max(500).optional(),
    }),
    ghl_contact_id: z.string().optional(),
    ghl_opportunity_id: z.string().optional(),
  })
  .refine((d) => d.product_slug || d.product_id, {
    message: "product_slug or product_id is required",
  });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Resolve product
  let productQuery = supabase
    .from("products")
    .select("id, name, slug, price_per_day, stock, is_active");

  if (parsed.data.product_id) {
    productQuery = productQuery.eq("id", parsed.data.product_id);
  } else {
    productQuery = productQuery.eq("slug", parsed.data.product_slug!);
  }

  const { data: product, error: prodErr } = await productQuery.single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.is_active) {
    return NextResponse.json(
      { error: "Product currently unavailable" },
      { status: 409 }
    );
  }

  // 2. Check date availability
  const date = parsed.data.event_date;

  // Blocked dates
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("reason")
    .eq("product_id", product.id)
    .eq("blocked_date", date)
    .maybeSingle();

  if (blocked) {
    return NextResponse.json(
      { error: "Date is blocked", reason: blocked.reason },
      { status: 409 }
    );
  }

  // Active bookings (count vs stock, excluding expired holds)
  const nowISO = new Date().toISOString();
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id, booking_status, hold_expires_at")
    .eq("product_id", product.id)
    .eq("event_date", date)
    .in("booking_status", ["pending_payment", "confirmed", "delivered"]);

  const stillActive = (activeBookings || []).filter((b) => {
    if (b.booking_status !== "pending_payment") return true;
    if (!b.hold_expires_at) return true;
    return b.hold_expires_at > nowISO;
  });

  if (stillActive.length >= product.stock) {
    return NextResponse.json(
      { error: "Already booked", available_after: null },
      { status: 409 }
    );
  }

  // 3. Create booking with hold
  const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      ghl_contact_id: parsed.data.ghl_contact_id || null,
      ghl_opportunity_id: parsed.data.ghl_opportunity_id || null,
      customer_first_name: parsed.data.customer.first_name,
      customer_last_name: parsed.data.customer.last_name,
      customer_email: parsed.data.customer.email,
      customer_phone: parsed.data.customer.phone || null,
      customer_address: parsed.data.customer.address || null,
      event_date: date,
      start_time: parsed.data.start_time || null,
      end_time: parsed.data.end_time || null,
      product_id: product.id,
      product_name: product.name,
      total_amount: product.price_per_day,
      stripe_payment_status: "pending",
      booking_status: "pending_payment",
      hold_expires_at: holdExpiresAt,
    })
    .select("id")
    .single();

  if (bookErr || !booking) {
    return NextResponse.json(
      { error: "Failed to create booking", details: bookErr?.message },
      { status: 500 }
    );
  }

  // 4. Create Stripe Payment Intent (FULL amount, 100% upfront)
  let clientSecret: string | null = null;
  let paymentIntentId: string | null = null;

  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: product.price_per_day,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `${product.name} rental — ${date}`,
        metadata: {
          booking_id: booking.id,
          product_id: product.id,
          product_slug: product.slug,
          event_date: date,
          customer_email: parsed.data.customer.email,
        },
        receipt_email: parsed.data.customer.email,
      });

      clientSecret = intent.client_secret;
      paymentIntentId = intent.id;

      // Persist payment intent ID on the booking
      await supabase
        .from("bookings")
        .update({ stripe_payment_intent_id: paymentIntentId })
        .eq("id", booking.id);
    } catch (e: any) {
      // Roll back the booking — Stripe failed
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json(
        { error: "Payment setup failed", details: e.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    booking_id: booking.id,
    hold_id: booking.id, // alias — booking ID acts as the hold token
    hold_expires_at: holdExpiresAt,
    amount: product.price_per_day,
    currency: "usd",
    product_name: product.name,
    client_secret: clientSecret, // null if Stripe not configured yet
    payment_intent_id: paymentIntentId,
  });
}
