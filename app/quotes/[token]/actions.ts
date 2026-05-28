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
  const finalTotalCents = Number(quote.total_cents) + protectionCents;

  // Create booking — use first line item's product as primary booking product,
  // and build a combined product_name from all line items.
  const items = (quote.line_items || []) as any[];
  if (items.length === 0) return { error: "Quote has no line items" };

  const primaryItem = items[0];
  const productName =
    items.length === 1
      ? primaryItem.name
      : `${primaryItem.name} + ${items.length - 1} more item${items.length > 2 ? "s" : ""}`;

  const noteParts: string[] = [`From quote ${quote.quote_number}`];
  if (items.length > 1) {
    noteParts.push(`Line items: ${items.map((it: any) => `${it.quantity}× ${it.name}`).join(", ")}`);
  }
  if (protectionAccepted) {
    noteParts.push(`Damage protection: opted in (+$${(protectionCents / 100).toFixed(2)})`);
  }

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
      damage_protection: protectionAccepted,
      stripe_payment_status: "pending",
      booking_status: "pending_payment",
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
