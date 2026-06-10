// POST /api/gift-cards/purchase
// Body: { amount_cents, purchaser_name, purchaser_email, recipient_name?,
//         recipient_email, message?, deliver_at? }
//
// Creates a pending gift_card_purchases row + Stripe PaymentIntent.
// Webhook /api/webhooks/stripe finalizes (issues gift_cards row, emails recipient).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { isGiftCardSalesEnabled } from "@/lib/gift-cards";
import { getCurrentTenantId } from "@/lib/tenant/db";

export const dynamic = "force-dynamic";

const MIN_CENTS = 1000;       // $10
const MAX_CENTS = 1_000_000;  // $10,000

const BodySchema = z.object({
  amount_cents: z.number().int().min(MIN_CENTS).max(MAX_CENTS),
  purchaser_name: z.string().min(1).max(200),
  purchaser_email: z.string().email().max(200),
  recipient_name: z.string().max(200).optional().nullable(),
  recipient_email: z.string().email().max(200),
  message: z.string().max(1000).optional().nullable(),
  deliver_at: z.string().datetime().optional().nullable(),
});

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payments not configured yet — please call to purchase." },
      { status: 503 },
    );
  }

  if (!(await isGiftCardSalesEnabled())) {
    return NextResponse.json(
      { error: "Gift card sales are temporarily disabled — please call to purchase." },
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

  const supabase = createAdminClient();

  // Insert pending purchase
  const { data: purchase, error: insertErr } = await supabase
    .from("gift_card_purchases")
    .insert({
      amount_cents: parsed.data.amount_cents,
      purchaser_name: parsed.data.purchaser_name.trim(),
      purchaser_email: parsed.data.purchaser_email.trim().toLowerCase(),
      recipient_name: parsed.data.recipient_name?.trim() || null,
      recipient_email: parsed.data.recipient_email.trim().toLowerCase(),
      message: parsed.data.message?.trim() || null,
      deliver_at: parsed.data.deliver_at || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr || !purchase) {
    return NextResponse.json(
      { error: "Could not save purchase", details: insertErr?.message },
      { status: 500 },
    );
  }

  // Create Stripe PaymentIntent
  let clientSecret: string | null = null;
  let paymentIntentId: string | null = null;
  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: parsed.data.amount_cents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Gift card purchase — $${(parsed.data.amount_cents / 100).toFixed(2)} to ${parsed.data.recipient_email}`,
      metadata: {
        type: "gift_card_purchase",
        gift_card_purchase_id: purchase.id,
        tenant_id: getCurrentTenantId(),
        purchaser_email: parsed.data.purchaser_email,
        recipient_email: parsed.data.recipient_email,
        amount_cents: String(parsed.data.amount_cents),
      },
      receipt_email: parsed.data.purchaser_email,
    });
    clientSecret = intent.client_secret;
    paymentIntentId = intent.id;

    await supabase
      .from("gift_card_purchases")
      .update({ stripe_payment_intent_id: paymentIntentId })
      .eq("id", purchase.id);
  } catch (e: any) {
    // Roll back the purchase row if Stripe fails
    await supabase.from("gift_card_purchases").delete().eq("id", purchase.id);
    return NextResponse.json(
      { error: "Payment setup failed", details: e.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    purchase_id: purchase.id,
    client_secret: clientSecret,
    payment_intent_id: paymentIntentId,
    amount_cents: parsed.data.amount_cents,
  });
}
