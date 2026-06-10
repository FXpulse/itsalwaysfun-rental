// POST /api/bookings/extend
// Customer requests to add more days to an existing booking. Validates
// ownership + availability for each new day + that they're actually extending
// (not shortening). Creates a Stripe PaymentIntent for the additional cost
// and an extension row in 'pending' status. Webhook will flip to 'paid' and
// update bookings.event_end_date + total_amount.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { multiDayBreakdown } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const MAX_TOTAL_DAYS = 14;
const MIN_LEAD_HOURS = 6;  // must request extension at least 6h before event start

const BodySchema = z.object({
  booking_id: z.string().uuid(),
  new_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payments not configured — please call to extend." },
      { status: 503 },
    );
  }

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
      { status: 400 },
    );
  }

  // Auth check — customer must own the booking
  const authClient = createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", parsed.data.booking_id)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.customer_email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Not your booking" }, { status: 403 });
  }
  if (booking.booking_status === "cancelled") {
    return NextResponse.json({ error: "Cancelled bookings can't be extended" }, { status: 400 });
  }
  if (booking.stripe_payment_status !== "paid") {
    return NextResponse.json(
      { error: "Pay the original booking first before extending" },
      { status: 400 },
    );
  }

  const currentEnd = booking.event_end_date || booking.event_date;
  const newEnd = parsed.data.new_end_date;

  if (newEnd <= currentEnd) {
    return NextResponse.json(
      { error: "New end date must be AFTER your current end date" },
      { status: 400 },
    );
  }

  // Min lead: must request at least 6h before event start time
  const startTime = booking.start_time || "09:00:00";
  const eventStart = new Date(`${booking.event_date}T${startTime}`);
  const hoursUntil = (eventStart.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < MIN_LEAD_HOURS && hoursUntil > 0) {
    return NextResponse.json(
      { error: `Extensions close ${MIN_LEAD_HOURS}h before event start — call us if urgent.` },
      { status: 400 },
    );
  }

  // Total rental can't exceed 14 days
  const allDays = datesInRange(booking.event_date, newEnd);
  if (allDays.length > MAX_TOTAL_DAYS) {
    return NextResponse.json(
      { error: `Total rental can't exceed ${MAX_TOTAL_DAYS} days` },
      { status: 400 },
    );
  }

  // Availability check for the NEW days only (anything after currentEnd)
  const newDays = datesInRange(
    new Date(new Date(currentEnd).getTime() + 86400000).toISOString().split("T")[0],
    newEnd,
  );

  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("blocked_date")
    .eq("product_id", booking.product_id)
    .in("blocked_date", newDays);
  if ((blocked || []).length > 0) {
    return NextResponse.json(
      {
        error: `Some of those days are blocked: ${(blocked as any[]).map((b) => b.blocked_date).join(", ")}`,
      },
      { status: 409 },
    );
  }

  const { data: otherBookings } = await supabase
    .from("bookings")
    .select("id, event_date, event_end_date")
    .eq("product_id", booking.product_id)
    .in("booking_status", ["pending_payment", "confirmed", "delivered"])
    .neq("id", booking.id);

  for (const ob of (otherBookings as any[]) || []) {
    const obDays = datesInRange(ob.event_date, ob.event_end_date || ob.event_date);
    const overlap = obDays.some((d) => newDays.includes(d));
    if (overlap) {
      return NextResponse.json(
        { error: "Those extra days are already booked by someone else" },
        { status: 409 },
      );
    }
  }

  // Calculate extension price using same per-day breakdown (handles weekend rates)
  // We compute the FULL breakdown for the entire new range and subtract what
  // the customer originally paid for the product subtotal.
  const { data: product } = await supabase
    .from("products")
    .select("price_per_day, weekend_price_per_day, name")
    .eq("id", booking.product_id)
    .single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const originalDays = datesInRange(booking.event_date, currentEnd);
  const newDaysBreakdown = multiDayBreakdown(
    newDays,
    product.price_per_day,
    product.weekend_price_per_day || null,
  );

  // For extension days, every one of them is a "day 2+" — so apply the
  // additional-day surcharge (30%) on each day's base rate.
  // multiDayBreakdown treats index 0 as full price — so for extension days
  // we need to re-compute treating them all as additional.
  const ADD_DAY_PCT = 0.30;
  let additionalAmountCents = 0;
  for (const day of newDays) {
    const isWeekend = ["0", "6"].includes(String(new Date(day + "T00:00:00").getDay()));
    const base = isWeekend && product.weekend_price_per_day
      ? product.weekend_price_per_day
      : product.price_per_day;
    additionalAmountCents += Math.round(base * ADD_DAY_PCT);
  }

  if (additionalAmountCents <= 0) {
    return NextResponse.json({ error: "Extension price calculation error" }, { status: 500 });
  }

  // Create extension row + Stripe PaymentIntent
  const { data: extension, error: insertErr } = await supabase
    .from("booking_extensions")
    .insert({
      booking_id: booking.id,
      original_end_date: currentEnd,
      new_end_date: newEnd,
      additional_days: newDays.length,
      additional_amount_cents: additionalAmountCents,
      requested_by_email: user.email,
      stripe_payment_status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !extension) {
    return NextResponse.json(
      { error: "Failed to save extension", details: insertErr?.message },
      { status: 500 },
    );
  }

  let clientSecret: string | null = null;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: additionalAmountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Extension: ${product.name} +${newDays.length} day${newDays.length > 1 ? "s" : ""} until ${newEnd}`,
      metadata: {
        type: "booking_extension",
        extension_id: extension.id,
        booking_id: booking.id,
        tenant_id: booking.tenant_id,
        new_end_date: newEnd,
        additional_days: String(newDays.length),
      },
      receipt_email: user.email,
    });
    clientSecret = intent.client_secret;
    await supabase
      .from("booking_extensions")
      .update({ stripe_payment_intent_id: intent.id })
      .eq("id", extension.id);
  } catch (e: any) {
    await supabase.from("booking_extensions").delete().eq("id", extension.id);
    return NextResponse.json(
      { error: "Payment setup failed", details: e.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    extension_id: extension.id,
    client_secret: clientSecret,
    additional_amount_cents: additionalAmountCents,
    additional_days: newDays.length,
    new_end_date: newEnd,
  });
}
