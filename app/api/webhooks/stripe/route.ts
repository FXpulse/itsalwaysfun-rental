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
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addContactNote, upsertContact, addContactTags } from "@/lib/ghl/client";
import { getTenantGhlConfig } from "@/lib/ghl/tenant-config";
import { awardForPaidBooking } from "@/lib/loyalty";
import { sendBookingConfirmation } from "@/lib/email/scheduled-emails";
import { sendTemplated } from "@/lib/email/send-template";
import { isEmailConfigured } from "@/lib/email/send";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { getTenantInfo } from "@/lib/tenant/business";
import { sendSms, isSmsConfigured } from "@/lib/sms/send";
import { renderTemplateSms } from "@/lib/email/render-template";

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

  const supabase = createAdminClient({ unscoped: true });

  // ── PAYMENT SUCCEEDED ───────────────────────────────────────────
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Branch by metadata.type. Default = rental booking (legacy).
    if (pi.metadata?.type === "gift_card_purchase") {
      return await fulfillGiftCardPurchase(pi);
    }
    if (pi.metadata?.type === "booking_extension") {
      return await fulfillBookingExtension(pi);
    }

    const bookingId = pi.metadata?.booking_id;

    if (!bookingId) {
      return NextResponse.json({ received: true, note: "no booking_id in metadata" });
    }

    // Idempotency guard: only transition a booking from pending → confirmed.
    // Stripe retries delivery up to 3 days; without this guard a late retry
    // could overwrite a manually cancelled booking back to confirmed.
    // Defense in depth: also verify tenant_id matches metadata if provided.
    const updateQuery = supabase
      .from("bookings")
      .update({
        booking_status: "confirmed",
        stripe_payment_status: "paid",
        hold_expires_at: null,
      })
      .eq("id", bookingId)
      .eq("stripe_payment_status", "pending");

    if (pi.metadata?.tenant_id) {
      updateQuery.eq("tenant_id", pi.metadata.tenant_id);
    }

    const { data: booking, error } = await updateQuery.select("*").maybeSingle();

    // No row updated could mean: already processed (idempotent, OK),
    // tenant mismatch (attack/bug — return 200 so Stripe doesn't retry
    // forever, but log loudly), or row was deleted.
    if (!booking && !error) {
      console.warn("[Stripe webhook] no-op update for booking", bookingId, {
        reason: "already paid, cancelled, or tenant mismatch",
        eventId: event.id,
      });
      // 2026-06-15 defense-in-depth: aunque la transición ya fue hecha por
      // otro path (markQuoteConverted, markAsPaidManually, retry duplicado),
      // intentamos disparar la confirmación. sendBookingConfirmation skipea
      // automáticamente si booking_emails_sent ya tiene un registro, así
      // que es seguro llamarla siempre.
      try {
        await sendBookingConfirmation(bookingId);
      } catch (e) {
        console.error("[booking confirmation email (no-op branch) failed, non-fatal]", e);
      }
      return NextResponse.json({ received: true, note: "no-op (already processed or cancelled)" });
    }

    if (error) {
      return NextResponse.json(
        { error: "Booking update failed", details: error.message },
        { status: 500 }
      );
    }

    // Fire booking.paid + booking.confirmed webhooks (fire-and-forget)
    if (booking.tenant_id) {
      const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatch");
      const payload = {
        booking_id: booking.id,
        customer_first_name: booking.customer_first_name,
        customer_last_name: booking.customer_last_name,
        customer_email: booking.customer_email,
        event_date: booking.event_date,
        product_name: booking.product_name,
        total_amount: booking.total_amount,
        amount_paid: pi.amount,
      };
      dispatchWebhookEvent({ tenant_id: booking.tenant_id, event: "booking.paid", payload })
        .catch((e) => console.error("[webhook booking.paid failed]", e?.message));
      dispatchWebhookEvent({ tenant_id: booking.tenant_id, event: "booking.confirmed", payload })
        .catch((e) => console.error("[webhook booking.confirmed failed]", e?.message));
    }

    // Best-effort GHL sync (don't fail the webhook if GHL fails). Per-tenant
    // GHL sub-account — pull location_id from tenant config (NOT env). When
    // the tenant has no GHL location configured, skip the push entirely so
    // other tenants' customers don't leak into IAF's CRM.
    const ghlTenantId = booking.tenant_id || pi.metadata?.tenant_id || null;
    try {
      const ghlConfig = await getTenantGhlConfig(ghlTenantId);
      if (!ghlConfig) {
        Sentry.addBreadcrumb({
          category: "ghl",
          message: "GHL push skipped — tenant has no location_id",
          level: "info",
          data: { reason: "no_location" },
        });
        Sentry.captureMessage("GHL push skipped — no tenant location", {
          level: "info",
          tags: { area: "ghl", tenant_id: ghlTenantId || "" },
          extra: { reason: "no_location" },
        });
      } else {
        const { contact } = await upsertContact({
          firstName: booking.customer_first_name,
          lastName: booking.customer_last_name,
          email: booking.customer_email,
          phone: booking.customer_phone || undefined,
          address: booking.customer_address || undefined,
          tags: ["paid-customer", "prospector-rental-customer"],
          locationId: ghlConfig.location_id,
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
      }
    } catch (e) {
      console.error("[GHL sync failed, non-fatal]", e);
    }

    // Increment coupon current_uses now that payment is confirmed
    // (was previously done at hold-creation time, which over-counted
    // when holds expired without payment).
    if (booking.coupon_code && booking.tenant_id) {
      try {
        const { incrementCouponUses } = await import("@/lib/coupons/counter");
        await incrementCouponUses({ code: booking.coupon_code, tenantId: booking.tenant_id });
      } catch (e) {
        console.error("[coupon increment failed, non-fatal]", e);
      }
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

    if (pi.metadata?.type === "gift_card_purchase") {
      const purchaseId = pi.metadata?.gift_card_purchase_id;
      if (purchaseId) {
        await supabase
          .from("gift_card_purchases")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            failure_reason: pi.last_payment_error?.message || "Payment failed",
          })
          .eq("id", purchaseId);
      }
      return NextResponse.json({ received: true, type: "gift_card_purchase", status: "failed" });
    }

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
      // Find the booking first so we can decrement the coupon counter
      const { data: refundedBooking } = await supabase
        .from("bookings")
        .select("id, coupon_code, tenant_id, stripe_payment_status")
        .eq("stripe_payment_intent_id", charge.payment_intent)
        .maybeSingle();

      await supabase
        .from("bookings")
        .update({ stripe_payment_status: "refunded", booking_status: "cancelled" })
        .eq("stripe_payment_intent_id", charge.payment_intent);

      // Decrement coupon if this booking was using one
      if (refundedBooking && (refundedBooking as any).coupon_code && (refundedBooking as any).tenant_id) {
        try {
          const { decrementCouponUses } = await import("@/lib/coupons/counter");
          await decrementCouponUses({
            code: (refundedBooking as any).coupon_code,
            tenantId: (refundedBooking as any).tenant_id,
          });
        } catch (e) {
          console.error("[coupon decrement on refund failed, non-fatal]", e);
        }
      }
    }
    return NextResponse.json({ received: true, type: "refund" });
  }

  // ── TENANT SUBSCRIPTION EVENTS (RentalFlow billing tenants) ─────
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    // Resolve tier from the first line item's price
    const priceId = sub.items.data[0]?.price.id;
    let tier: string | null = null;
    if (priceId === process.env.STRIPE_PRICE_STARTER) tier = "starter";
    else if (priceId === process.env.STRIPE_PRICE_PRO) tier = "pro";
    else if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) tier = "enterprise";

    const updates: any = {
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    };
    if (tier) updates.plan = tier;

    await supabase
      .from("tenants")
      .update(updates)
      .eq("stripe_customer_id", customerId);

    return NextResponse.json({
      received: true,
      event_type: event.type,
      subscription_status: sub.status,
      tier,
    });
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as Stripe.Invoice;
    const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
    if (customerId) {
      await supabase
        .from("tenants")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId);
    }
    return NextResponse.json({ received: true, event_type: event.type });
  }

  // Other events — ack but ignore
  return NextResponse.json({ received: true, event_type: event.type });
}

// ── Booking extension fulfillment ────────────────────────────────
// Idempotent: if the extension row is already 'paid' (webhook retry) we no-op.
// On success: flip extension to paid + bump bookings.event_end_date + add to
// total_amount + audit-line in notes.
async function fulfillBookingExtension(pi: Stripe.PaymentIntent) {
  const supabase = createAdminClient({ unscoped: true });
  const extensionId = pi.metadata?.extension_id;
  if (!extensionId) {
    return NextResponse.json(
      { received: true, error: "Missing extension_id in metadata" },
      { status: 200 },
    );
  }

  const { data: extension } = await supabase
    .from("booking_extensions")
    .select("*")
    .eq("id", extensionId)
    .single();
  if (!extension) {
    return NextResponse.json({ received: true, error: "Extension not found" }, { status: 200 });
  }
  if (extension.stripe_payment_status === "paid") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Mark extension paid
  await supabase
    .from("booking_extensions")
    .update({
      stripe_payment_status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", extensionId);

  // Bump the parent booking's end date + total
  const { data: booking } = await supabase
    .from("bookings")
    .select("total_amount, notes, event_end_date, event_date")
    .eq("id", extension.booking_id)
    .single();
  if (booking) {
    const newTotal = (booking.total_amount || 0) + extension.additional_amount_cents;
    const auditLine = `[${new Date().toISOString().split("T")[0]}] Extended to ${extension.new_end_date} (+${extension.additional_days} day${extension.additional_days > 1 ? "s" : ""}, +$${(extension.additional_amount_cents / 100).toFixed(2)})`;
    const newNotes = booking.notes ? `${booking.notes}\n${auditLine}` : auditLine;
    await supabase
      .from("bookings")
      .update({
        event_end_date: extension.new_end_date,
        total_amount: newTotal,
        notes: newNotes,
      })
      .eq("id", extension.booking_id);
  }

  return NextResponse.json({
    received: true,
    type: "booking_extension",
    status: "paid",
    extension_id: extensionId,
  });
}

// ── Gift card purchase fulfillment ───────────────────────────────
// Idempotent: if status is already 'paid' (e.g. webhook retry) we no-op.
async function fulfillGiftCardPurchase(pi: Stripe.PaymentIntent) {
  const supabase = createAdminClient({ unscoped: true });
  const purchaseId = pi.metadata?.gift_card_purchase_id;
  if (!purchaseId) {
    return NextResponse.json(
      { received: true, error: "Missing gift_card_purchase_id in metadata" },
      { status: 200 },
    );
  }

  const { data: purchase } = await supabase
    .from("gift_card_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();
  if (!purchase) {
    return NextResponse.json(
      { received: true, error: "Purchase not found" },
      { status: 200 },
    );
  }
  if (purchase.status === "paid" && purchase.gift_card_id) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Generate code + issue the gift card
  const { data: codeRow } = await supabase.rpc("generate_gift_card_code");
  const code = codeRow as string;
  if (!code) {
    return NextResponse.json(
      { received: true, error: "Failed to generate gift card code" },
      { status: 500 },
    );
  }

  const { data: card, error: cardErr } = await supabase
    .from("gift_cards")
    .insert({
      code,
      original_amount_cents: purchase.amount_cents,
      balance_cents: purchase.amount_cents,
      purchaser_email: purchase.purchaser_email,
      purchaser_name: purchase.purchaser_name,
      recipient_email: purchase.recipient_email,
      recipient_name: purchase.recipient_name,
      message: purchase.message,
      stripe_payment_intent_id: pi.id,
      is_active: true,
    })
    .select("id, code")
    .single();

  if (cardErr || !card) {
    return NextResponse.json(
      { received: true, error: `Gift card creation failed: ${cardErr?.message}` },
      { status: 500 },
    );
  }

  await supabase
    .from("gift_card_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      gift_card_id: card.id,
    })
    .eq("id", purchaseId);

  // Email the recipient (best-effort)
  if (isEmailConfigured()) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://www.getrentalflow.com";
    const amountDollars = (purchase.amount_cents / 100).toFixed(2);
    // Resolve tenant brand from the purchase row (webhook runs without
    // request context so getCurrentTenantId() isn't available).
    const tenantBrand = await getTenantInfo((purchase as any).tenant_id);
    const brandName = tenantBrand.business_name;
    const tenantEmail = await getTenantEmailConfig((purchase as any).tenant_id);
    if (!tenantEmail) {
      Sentry.captureMessage("Tenant email skipped — no custom domain configured", {
        level: "warning",
        tags: { tenant_id: (purchase as any).tenant_id || "", area: "tenant-email" },
      });
      return NextResponse.json({ ok: false, error: "tenant_missing_custom_domain" }, { status: 200 });
    }
    try {
      await sendTemplated({
        key: "gift_card_received",
        to: purchase.recipient_email,
        from: tenantEmail.from,
        replyTo: tenantEmail.replyTo,
        vars: {
          recipientName: purchase.recipient_name || "there",
          purchaserName: purchase.purchaser_name || "a friend",
          amount: amountDollars,
          code: card.code,
          message: purchase.message || "",
          bookingUrl: `${baseUrl}/order-by-date`,
          expiresAt: "",
        },
        fallback: () => ({
          subject: `🎁 You received a $${amountDollars} gift card!`,
          html: `<p>Hi ${purchase.recipient_name || "there"},</p>
<p><strong>${purchase.purchaser_name || "Someone"}</strong> sent you a gift card from ${brandName} for <strong>$${amountDollars}</strong>!</p>
${purchase.message ? `<blockquote>"${purchase.message}"</blockquote>` : ""}
<p>Your code: <strong style="font-family:monospace;font-size:18px;background:#FFD700;padding:6px 12px;border-radius:4px;">${card.code}</strong></p>
<p>Use it at checkout: <a href="${baseUrl}/order-by-date">${baseUrl}/order-by-date</a></p>
<p>— The ${brandName} team</p>`,
          text: `You received a $${amountDollars} gift card!\nCode: ${card.code}\nUse it at ${baseUrl}/order-by-date`,
        }),
        tags: [{ name: "type", value: "gift_card_received" }],
      });

      await supabase
        .from("gift_cards")
        .update({ sent_to_recipient_at: new Date().toISOString() })
        .eq("id", card.id);
    } catch (e) {
      console.error("[gift card recipient email failed, non-fatal]", e);
    }

    // SMS the recipient if they gave a phone — short heads-up with code,
    // plus a "check spam" reminder so the email doesn't get lost.
    if (isSmsConfigured() && purchase.recipient_phone) {
      try {
        const smsBody = await renderTemplateSms(
          "gift_card_received",
          {
            recipientName: purchase.recipient_name || "there",
            purchaserName: purchase.purchaser_name || "a friend",
            amount: amountDollars,
            code: card.code,
          },
          (purchase as any).tenant_id,
        );
        if (smsBody) {
          await sendSms({ to: purchase.recipient_phone, body: smsBody }).catch(() => {});
        }
      } catch (e) {
        console.error("[gift card recipient SMS failed, non-fatal]", e);
      }
    }

    // Also email the purchaser a receipt confirmation
    try {
      await sendTemplated({
        key: "gift_card_purchase_receipt",
        to: purchase.purchaser_email,
        from: tenantEmail.from,
        replyTo: tenantEmail.replyTo,
        vars: {
          purchaserName: purchase.purchaser_name,
          recipientName: purchase.recipient_name || purchase.recipient_email,
          recipientEmail: purchase.recipient_email,
          amount: amountDollars,
          code: card.code,
        },
        fallback: () => ({
          subject: `✅ Your $${amountDollars} gift card purchase`,
          html: `<p>Hi ${purchase.purchaser_name},</p>
<p>Thanks for your purchase! We've emailed a <strong>$${amountDollars}</strong> gift card to <strong>${purchase.recipient_email}</strong>.</p>
<p>Gift card code (for your records): <code>${card.code}</code></p>
<p>If they don't see it, ask them to check spam.</p>
<p>— The ${brandName} team</p>`,
          text: `Your $${amountDollars} gift card to ${purchase.recipient_email} has been delivered.\nCode (for your records): ${card.code}`,
        }),
        tags: [{ name: "type", value: "gift_card_purchase_receipt" }],
      });
    } catch (e) {
      console.error("[gift card purchaser receipt failed, non-fatal]", e);
    }
  }

  return NextResponse.json({
    received: true,
    type: "gift_card_purchase",
    status: "paid",
    code: card.code,
  });
}
