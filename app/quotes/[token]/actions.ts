"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

const ApproveInputSchema = z.object({
  surface_type: z.enum(["dirt", "grass", "concrete", "paver", "asphalt", "other"]),
  needs_power_supply: z.boolean(),
  damage_protection_accepted: z.boolean().optional().nullable(),
  waiver_signed_name: z.string().trim().min(2).max(200).optional().nullable(),
});

export type ApproveInput = z.infer<typeof ApproveInputSchema>;

// 24h hold from quote approval — gives customer a day to complete payment.
// After this expires, the inventory becomes available to other bookings.
const QUOTE_HOLD_HOURS = 24;

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

/** Check availability for every line item that has a product_id. Returns
 *  null if all are available, or a human-friendly error string naming
 *  the conflicting products + dates if any are sold out.
 *
 *  Counts occupied inventory from BOTH the primary product_id AND any
 *  items inside other bookings' addons JSONB array — so multi-product
 *  quotes (and addons from the public booking flow) are properly held.
 *
 *  excludeBookingId lets the re-check at payment time ignore the
 *  customer's own held booking. */
async function checkLineItemsAvailability(
  supabase: any,
  items: any[],
  startDate: string,
  endDate: string,
  excludeBookingId?: string,
): Promise<string | null> {
  const productIds = items
    .map((it: any) => it.product_id)
    .filter(Boolean) as string[];
  if (productIds.length === 0) return null;

  // Aggregate target quantity per product (e.g. 2× chairs = need 2 units)
  const requestedByProduct: Record<string, number> = {};
  for (const it of items) {
    if (!it.product_id) continue;
    requestedByProduct[it.product_id] =
      (requestedByProduct[it.product_id] || 0) + (Number(it.quantity) || 1);
  }
  const targetProductIds = Object.keys(requestedByProduct);

  // Pull stock for the target products
  const { data: productRows } = await supabase
    .from("products")
    .select("id, name, stock")
    .in("id", targetProductIds);

  const productsById = new Map<string, { name: string; stock: number }>();
  for (const p of (productRows as any[]) || []) {
    productsById.set(p.id, { name: p.name, stock: Number(p.stock) || 0 });
  }

  // Pull ALL active bookings that overlap the date window, regardless of
  // their primary product — we need to scan their addons too.
  let query = supabase
    .from("bookings")
    .select(
      "id, event_date, event_end_date, booking_status, hold_expires_at, product_id, addons",
    )
    .lte("event_date", endDate)
    .or(
      `event_end_date.gte.${startDate},and(event_end_date.is.null,event_date.gte.${startDate})`,
    )
    .in("booking_status", ["pending_payment", "confirmed", "delivered"]);
  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }
  const { data: existingBookings } = await query;

  const nowISO = new Date().toISOString();

  // occupied[productId][day] = total units occupied that day
  const occupied: Record<string, Record<string, number>> = {};
  for (const b of (existingBookings as any[]) || []) {
    // Skip expired holds — those slots are free
    if (
      b.booking_status === "pending_payment" &&
      b.hold_expires_at &&
      b.hold_expires_at < nowISO
    ) {
      continue;
    }

    // Build list of {productId, quantity} occupied by this booking
    const itemsHeld: Array<{ pid: string; qty: number }> = [];
    if (b.product_id) itemsHeld.push({ pid: b.product_id, qty: 1 });
    for (const a of (b.addons as any[]) || []) {
      if (!a?.product_id) continue;
      itemsHeld.push({ pid: a.product_id, qty: Number(a.quantity) || 1 });
    }

    const daysOverlap: string[] = [];
    const bStart = b.event_date;
    const bEnd = b.event_end_date || b.event_date;
    for (const day of datesInRange(bStart, bEnd)) {
      if (day >= startDate && day <= endDate) daysOverlap.push(day);
    }

    for (const { pid, qty } of itemsHeld) {
      // Only track products we care about (the ones we're checking)
      if (!productsById.has(pid)) continue;
      occupied[pid] = occupied[pid] || {};
      for (const day of daysOverlap) {
        occupied[pid][day] = (occupied[pid][day] || 0) + qty;
      }
    }
  }

  // Compare with target requested quantities
  const errors: string[] = [];
  for (const pid of targetProductIds) {
    const p = productsById.get(pid);
    if (!p || p.stock <= 0) continue; // unlimited / unknown — skip
    const requested = requestedByProduct[pid] || 1;

    const dayCounts = occupied[pid] || {};
    const conflictDays = Object.entries(dayCounts)
      .filter(([_, count]) => count + requested > p.stock)
      .map(([day]) => day);
    if (conflictDays.length > 0) {
      errors.push(`${p.name} on ${conflictDays.join(", ")}`);
    }
  }

  if (errors.length === 0) return null;
  return `Sorry — these items are no longer available: ${errors.join("; ")}. Someone reserved them while this quote was open. Please contact us to find another date or substitute items.`;
}

/** Customer approves the quote with their setup choices.
 *  Validates required choices, then creates the booking + Stripe PaymentIntent.
 *  Returns client_secret for the Stripe Elements step. */
export async function approveQuote(token: string, input: ApproveInput) {
  if (!token || token.length < 8) return { error: "Invalid quote link" };

  const parsed = ApproveInputSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { error: `${first.path.join(".")}: ${first.message}` };
  }

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("token", token)
    .single();

  if (!quote) return { error: "Quote not found" };

  // Status guards
  if (quote.status === "approved" || quote.status === "converted") {
    return { error: "This quote has already been approved" };
  }
  if (quote.status === "declined") {
    return { error: "This quote was declined" };
  }
  if (quote.status === "expired" || (quote.expires_at && new Date(quote.expires_at) < new Date())) {
    return { error: "This quote has expired. Please contact us for a new one." };
  }
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return { error: "This quote is not available for approval" };
  }

  // Per-quote required decisions
  if (quote.damage_protection_offered && parsed.data.damage_protection_accepted === null) {
    return { error: "Choose Yes or No for damage protection before continuing." };
  }
  if (quote.waiver_required && !parsed.data.waiver_signed_name) {
    return { error: "Sign the liability waiver by typing your full name before continuing." };
  }

  // Decide protection price contribution (price snapshot from the quote)
  const protectionAccepted = !!parsed.data.damage_protection_accepted;
  const protectionCents = protectionAccepted ? Number(quote.damage_protection_cents || 0) : 0;

  // Create booking — use first line item's product as primary booking product,
  // and build a combined product_name from all line items.
  const items = (quote.line_items || []) as any[];
  if (items.length === 0) return { error: "Quote has no line items" };

  const primaryItem = items[0];
  const productName =
    items.length === 1
      ? primaryItem.name
      : `${primaryItem.name} + ${items.length - 1} more item${items.length > 2 ? "s" : ""}`;

  // Number of rental days for per-day pricing (power supply, etc.)
  const startDate: string = quote.event_date;
  const endDate: string = quote.event_end_date || quote.event_date;
  const numDays = Math.max(1, datesInRange(startDate, endDate).length);

  // ─── Power supply lookup (only if customer says they need one) ────
  let powerSupplyCents = 0;
  let powerSupplyAddon: any = null;
  if (parsed.data.needs_power_supply) {
    const { data: powerProduct } = await supabase
      .from("products")
      .select("id, name, slug, price_per_day")
      .eq("slug", "power-supply")
      .eq("is_addon", true)
      .eq("is_active", true)
      .maybeSingle();
    if (powerProduct) {
      const perDay = Number(powerProduct.price_per_day) || 0;
      powerSupplyCents = perDay * numDays;
      powerSupplyAddon = {
        product_id: powerProduct.id,
        slug: powerProduct.slug,
        name: powerProduct.name,
        quantity: 1,
        unit_price_cents: perDay,
        line_total_cents: powerSupplyCents,
      };
    }
    // If the tenant has no power-supply product configured, we still set
    // needs_power_supply=true so dispatch knows to bring one, but we
    // can't auto-add a charge (admin will handle it).
  }

  // Final total customer pays = quote line items + protection + power supply
  const finalTotalCents = Number(quote.total_cents) + protectionCents + powerSupplyCents;

  // ─── Build addons array: secondary line items + power supply ──────
  //     Stored on the booking row in the existing addons JSONB column,
  //     so the availability check (updated below) counts them as held
  //     inventory for the duration of the booking hold. ──────────────
  const bookingAddons: any[] = [];
  for (let i = 1; i < items.length; i++) {
    const it = items[i];
    if (!it.product_id) continue;  // custom lines without a product can't be held
    bookingAddons.push({
      product_id: it.product_id,
      slug: it.slug || null,
      name: it.name,
      quantity: Number(it.quantity) || 1,
      unit_price_cents: Number(it.unit_price_cents) || 0,
      line_total_cents: (Number(it.unit_price_cents) || 0) * (Number(it.quantity) || 1),
    });
  }
  if (powerSupplyAddon) bookingAddons.push(powerSupplyAddon);

  // ─── Availability check for ALL line items with a product_id +
  //     power supply if requested. ────────────────────────────────────
  const allItemsForCheck = [...items];
  if (powerSupplyAddon) {
    allItemsForCheck.push(powerSupplyAddon);
  }
  const conflicts = await checkLineItemsAvailability(supabase, allItemsForCheck, startDate, endDate);
  if (conflicts) return { error: conflicts };

  const noteParts: string[] = [`From quote ${quote.quote_number}`];
  if (items.length > 1) {
    noteParts.push(`Line items: ${items.map((it: any) => `${it.quantity}× ${it.name}`).join(", ")}`);
  }
  if (protectionAccepted) {
    noteParts.push(`Damage protection: opted in (+$${(protectionCents / 100).toFixed(2)})`);
  }
  if (powerSupplyCents > 0) {
    noteParts.push(`Power supply: customer needs generator (+$${(powerSupplyCents / 100).toFixed(2)})`);
  } else if (parsed.data.needs_power_supply) {
    noteParts.push(`Power supply: customer needs generator (no product configured — handle manually)`);
  }

  // 24h hold — gives customer time to pay; after expiry slot is free
  const holdExpiresAt = new Date(Date.now() + QUOTE_HOLD_HOURS * 60 * 60_000).toISOString();

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      customer_first_name: quote.customer_first_name,
      customer_last_name: quote.customer_last_name,
      customer_email: quote.customer_email,
      customer_phone: quote.customer_phone,
      customer_address: quote.customer_address,
      event_date: quote.event_date,
      event_end_date: quote.event_end_date,
      start_time: quote.start_time,
      end_time: quote.end_time,
      product_id: primaryItem.product_id || null,
      product_name: productName,
      total_amount: finalTotalCents,
      discount_amount: quote.discount_cents || 0,
      surface_type: parsed.data.surface_type,
      needs_power_supply: parsed.data.needs_power_supply,
      damage_protection_purchased: protectionAccepted,
      damage_protection_cents: protectionCents,
      addons: bookingAddons.length > 0 ? bookingAddons : null,
      stripe_payment_status: "pending",
      booking_status: "pending_payment",
      hold_expires_at: holdExpiresAt,
      notes: noteParts.join("\n"),
    })
    .select("id")
    .single();

  if (bookingErr || !booking) {
    return { error: `Failed to create booking: ${bookingErr?.message}` };
  }

  // Record waiver signature if required
  if (quote.waiver_required && parsed.data.waiver_signed_name) {
    try {
      await supabase.from("waivers").insert({
        booking_id: booking.id,
        signed_name: parsed.data.waiver_signed_name,
        signed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("[waiver insert failed — booking still created]", e);
    }
  }

  // Stripe Payment Intent
  let clientSecret: string | null = null;
  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: finalTotalCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `Quote ${quote.quote_number} — ${productName}`,
        metadata: {
          booking_id: booking.id,
          quote_id: quote.id,
          quote_number: quote.quote_number,
          customer_email: quote.customer_email,
        },
        receipt_email: quote.customer_email,
      });
      clientSecret = intent.client_secret;
      await supabase
        .from("bookings")
        .update({ stripe_payment_intent_id: intent.id })
        .eq("id", booking.id);
    } catch (e: any) {
      // Don't delete booking — admin can still process payment manually
      console.error("Stripe intent creation failed for quote", quote.id, e);
    }
  }

  // Update quote → approved + linked + record what the customer chose
  const { error: updateErr } = await supabase
    .from("quotes")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      converted_booking_id: booking.id,
      surface_type: parsed.data.surface_type,
      needs_power_supply: parsed.data.needs_power_supply,
      damage_protection_accepted: quote.damage_protection_offered ? protectionAccepted : null,
      waiver_signed_name: quote.waiver_required ? parsed.data.waiver_signed_name : null,
      waiver_signed_at: quote.waiver_required ? new Date().toISOString() : null,
    })
    .eq("id", quote.id);

  if (updateErr) {
    console.error("Failed to update quote status", updateErr);
  }

  revalidatePath(`/quotes/${token}`);
  revalidatePath(`/admin/quotes/${quote.id}`);

  return {
    success: true,
    booking_id: booking.id,
    client_secret: clientSecret,
    stripe_configured: isStripeConfigured(),
    amount: finalTotalCents,
  };
}

export async function declineQuote(token: string, reason: string) {
  if (!token || token.length < 8) return { error: "Invalid quote link" };

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("token", token)
    .single();
  if (!quote) return { error: "Quote not found" };
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return { error: "This quote cannot be declined at this stage" };
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
      decline_reason: reason.trim().substring(0, 500) || null,
    })
    .eq("id", quote.id);
  if (error) return { error: error.message };

  revalidatePath(`/quotes/${token}`);
  revalidatePath(`/admin/quotes/${quote.id}`);
  return { success: true };
}

/** Re-check availability + refresh hold for an approved quote whose
 *  24h hold has expired. Called from the public quote page when the
 *  customer returns after the hold window. If the slot is still free
 *  for ALL line items, extends the hold by 1 hour so they have time
 *  to complete the Stripe payment. Returns { refreshed, holdExpiresAt }
 *  on success or { error } if any item is no longer available. */
export async function refreshHoldOrFail(token: string): Promise<
  | { refreshed: true; holdExpiresAt: string }
  | { refreshed: false; reason: "still_valid" | "no_booking" | "paid" }
  | { error: string }
> {
  if (!token || token.length < 8) return { error: "Invalid quote link" };

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, converted_booking_id, event_date, event_end_date, line_items")
    .eq("token", token)
    .single();

  if (!quote) return { error: "Quote not found" };
  if (quote.status !== "approved") return { refreshed: false, reason: "paid" };
  if (!quote.converted_booking_id) return { refreshed: false, reason: "no_booking" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, hold_expires_at, stripe_payment_status, booking_status")
    .eq("id", quote.converted_booking_id)
    .single();

  if (!booking) return { refreshed: false, reason: "no_booking" };

  // Already paid / not pending — no refresh needed
  if (booking.stripe_payment_status === "paid") return { refreshed: false, reason: "paid" };
  if (booking.booking_status !== "pending_payment") return { refreshed: false, reason: "paid" };

  // Hold still valid → nothing to do
  const nowISO = new Date().toISOString();
  if (booking.hold_expires_at && booking.hold_expires_at > nowISO) {
    return { refreshed: false, reason: "still_valid" };
  }

  // Hold expired — re-check availability for ALL line items (excluding
  // the customer's own booking row so they don't conflict with themselves)
  const startDate: string = quote.event_date;
  const endDate: string = quote.event_end_date || quote.event_date;
  const conflicts = await checkLineItemsAvailability(
    supabase,
    (quote.line_items || []) as any[],
    startDate,
    endDate,
    booking.id,
  );
  if (conflicts) {
    return { error: conflicts };
  }

  // Still available — extend hold by 1 hour for payment completion
  const REFRESH_MINUTES = 60;
  const newHold = new Date(Date.now() + REFRESH_MINUTES * 60_000).toISOString();
  await supabase
    .from("bookings")
    .update({ hold_expires_at: newHold })
    .eq("id", booking.id);

  return { refreshed: true, holdExpiresAt: newHold };
}

/** Called after Stripe confirmation succeeds client-side. Marks the
 *  quote as converted (booking status will be updated by Stripe webhook). */
export async function markQuoteConverted(token: string) {
  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, converted_booking_id")
    .eq("token", token)
    .single();
  if (!quote) return { error: "Quote not found" };

  if (quote.status !== "approved") {
    // Could already be converted — that's fine
    return { success: true };
  }

  await supabase
    .from("quotes")
    .update({ status: "converted" })
    .eq("id", quote.id);

  // Also mark the booking as paid (webhook may have done this already)
  if (quote.converted_booking_id) {
    await supabase
      .from("bookings")
      .update({ stripe_payment_status: "paid", booking_status: "confirmed" })
      .eq("id", quote.converted_booking_id)
      .eq("stripe_payment_status", "pending"); // only if still pending
  }

  revalidatePath(`/quotes/${token}`);
  return { success: true };
}
