"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

/** Customer approves the quote.
 *  Creates a booking + Stripe PaymentIntent. Returns client_secret. */
export async function approveQuote(token: string) {
  if (!token || token.length < 8) return { error: "Invalid quote link" };

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

  // Create booking — use first line item's product as primary booking product,
  // and build a combined product_name from all line items.
  const items = (quote.line_items || []) as any[];
  if (items.length === 0) return { error: "Quote has no line items" };

  const primaryItem = items[0];
  const productName =
    items.length === 1
      ? primaryItem.name
      : `${primaryItem.name} + ${items.length - 1} more item${items.length > 2 ? "s" : ""}`;

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
      total_amount: quote.total_cents,
      discount_amount: quote.discount_cents || 0,
      stripe_payment_status: "pending",
      booking_status: "pending_payment",
      notes: `From quote ${quote.quote_number}${items.length > 1 ? `\nLine items: ${items.map((it: any) => `${it.quantity}× ${it.name}`).join(", ")}` : ""}`,
    })
    .select("id")
    .single();

  if (bookingErr || !booking) {
    return { error: `Failed to create booking: ${bookingErr?.message}` };
  }

  // Stripe Payment Intent
  let clientSecret: string | null = null;
  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: quote.total_cents,
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

  // Update quote → approved + linked
  const { error: updateErr } = await supabase
    .from("quotes")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      converted_booking_id: booking.id,
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
    amount: quote.total_cents,
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
