// POST /api/bookings/check-and-hold
// Body: { product_slug | product_id, event_date, event_end_date?, start_time?,
//         end_time?, customer: { first_name, last_name, email, phone?, address? } }
//
// Supports MULTI-DAY rentals: if event_end_date > event_date, all days in
// range must be available and total = price_per_day × num_days.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { multiDayTotal, applyCoupon } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const HOLD_MINUTES = 15;
const MAX_DAYS = 14;

const BodySchema = z
  .object({
    product_slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
    product_id: z.string().uuid().optional(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    event_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    customer: z.object({
      first_name: z.string().min(1).max(100),
      last_name: z.string().min(1).max(100),
      email: z.string().email(),
      phone: z.string().max(40).optional(),
      address: z.string().max(500).optional(),
    }),
    coupon_code: z.string().max(50).optional(),
    ghl_contact_id: z.string().optional(),
    ghl_opportunity_id: z.string().optional(),
  })
  .refine((d) => d.product_slug || d.product_id, {
    message: "product_slug or product_id is required",
  });

/** Return all ISO date strings from start to end inclusive. */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (e < s) return [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

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

  const startDate = parsed.data.event_date;
  const endDate = parsed.data.event_end_date || startDate;

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 }
    );
  }

  const days = datesInRange(startDate, endDate);
  if (days.length === 0 || days.length > MAX_DAYS) {
    return NextResponse.json(
      { error: `Rental range must be 1–${MAX_DAYS} days` },
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

  // 2. Check ALL days in range for blocks
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("blocked_date, reason")
    .eq("product_id", product.id)
    .in("blocked_date", days);

  if (blocked && blocked.length > 0) {
    return NextResponse.json(
      {
        error: `Date${blocked.length > 1 ? "s" : ""} blocked in your range`,
        blocked_dates: blocked.map((b) => b.blocked_date),
        reason: blocked[0].reason,
      },
      { status: 409 }
    );
  }

  // 3. Check ALL days for existing bookings (respect stock)
  const nowISO = new Date().toISOString();
  const { data: activeBookings } = await supabase
    .from("bookings")
    .select("id, event_date, event_end_date, booking_status, hold_expires_at")
    .eq("product_id", product.id)
    .lte("event_date", endDate)
    .or(`event_end_date.gte.${startDate},and(event_end_date.is.null,event_date.gte.${startDate})`)
    .in("booking_status", ["pending_payment", "confirmed", "delivered"]);

  // Build count-per-day, filtering expired holds
  const occupiedByDay: Record<string, number> = {};
  for (const b of activeBookings || []) {
    if (
      b.booking_status === "pending_payment" &&
      b.hold_expires_at &&
      b.hold_expires_at < nowISO
    ) {
      continue;
    }
    const bStart = b.event_date;
    const bEnd = b.event_end_date || b.event_date;
    for (const day of datesInRange(bStart, bEnd)) {
      if (day >= startDate && day <= endDate) {
        occupiedByDay[day] = (occupiedByDay[day] || 0) + 1;
      }
    }
  }

  const conflictDays = Object.entries(occupiedByDay)
    .filter(([_, count]) => count >= product.stock)
    .map(([day]) => day);

  if (conflictDays.length > 0) {
    return NextResponse.json(
      {
        error: "Some days in your range are already booked",
        conflict_dates: conflictDays,
      },
      { status: 409 }
    );
  }

  // 4. Calculate subtotal — multi-day: base + 30% × (days-1) × base
  const subtotal = multiDayTotal(product.price_per_day, days.length);

  // Apply coupon if provided
  let totalAmount = subtotal;
  let appliedCouponCode: string | null = null;
  let discountAmount = 0;

  if (parsed.data.coupon_code) {
    const code = parsed.data.coupon_code.trim().toUpperCase();
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .ilike("code", code)
      .maybeSingle();

    if (coupon && coupon.is_active) {
      const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
      const usedUp = coupon.max_uses != null && coupon.current_uses >= coupon.max_uses;
      if (!expired && !usedUp) {
        const { total, discount } = applyCoupon(subtotal, {
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
        });
        totalAmount = total;
        discountAmount = discount;
        appliedCouponCode = coupon.code;
      }
    }
  }

  // 5. Create booking with hold
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
      event_date: startDate,
      event_end_date: endDate,
      start_time: parsed.data.start_time || null,
      end_time: parsed.data.end_time || null,
      product_id: product.id,
      product_name: product.name,
      total_amount: totalAmount,
      coupon_code: appliedCouponCode,
      discount_amount: discountAmount,
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

  // 6. Stripe Payment Intent
  let clientSecret: string | null = null;
  let paymentIntentId: string | null = null;

  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `${product.name} rental — ${startDate}${endDate !== startDate ? ` to ${endDate}` : ""} (${days.length} day${days.length > 1 ? "s" : ""})`,
        metadata: {
          booking_id: booking.id,
          product_id: product.id,
          product_slug: product.slug,
          event_date: startDate,
          event_end_date: endDate,
          days: String(days.length),
          customer_email: parsed.data.customer.email,
        },
        receipt_email: parsed.data.customer.email,
      });

      clientSecret = intent.client_secret;
      paymentIntentId = intent.id;

      await supabase
        .from("bookings")
        .update({ stripe_payment_intent_id: paymentIntentId })
        .eq("id", booking.id);
    } catch (e: any) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json(
        { error: "Payment setup failed", details: e.message },
        { status: 500 }
      );
    }
  }

  // Increment coupon usage (best-effort — don't block booking)
  if (appliedCouponCode) {
    try {
      const { data: c } = await supabase
        .from("coupons")
        .select("current_uses")
        .eq("code", appliedCouponCode)
        .single();
      if (c) {
        await supabase
          .from("coupons")
          .update({ current_uses: (c.current_uses || 0) + 1 })
          .eq("code", appliedCouponCode);
      }
    } catch {
      // ignore — booking already saved, counter is non-critical
    }
  }

  return NextResponse.json({
    booking_id: booking.id,
    hold_id: booking.id,
    hold_expires_at: holdExpiresAt,
    subtotal,
    discount: discountAmount,
    amount: totalAmount,
    coupon_code: appliedCouponCode,
    days: days.length,
    event_date: startDate,
    event_end_date: endDate,
    currency: "usd",
    product_name: product.name,
    client_secret: clientSecret,
    payment_intent_id: paymentIntentId,
  });
}
