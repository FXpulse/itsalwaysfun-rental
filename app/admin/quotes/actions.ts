"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { getTenantEmailConfig } from "@/lib/email/tenant-email";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { requireAdmin } from "@/lib/auth/roles";
import { isEmailConfigured } from "@/lib/email/send";
import { sendTemplated } from "@/lib/email/send-template";
import { renderQuoteEmail } from "@/lib/email/templates";
import { getTenantInfo, tenantToEmailBrand } from "@/lib/tenant/business";
import { formatDateUS } from "@/lib/email/format-date";
import { z } from "zod";

const LineItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.number().int().min(1),
  unit_price_cents: z.number().int().min(0),
  tax_exempt: z.boolean().optional().default(false),
});

const QuoteInputSchema = z.object({
  customer_first_name: z.string().min(1).max(100),
  customer_last_name: z.string().min(1).max(100),
  customer_company: z.string().max(200).optional().nullable(),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1).max(40),
  customer_address: z.string().max(500).optional().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  line_items: z.array(LineItemSchema).min(1),
  discount_cents: z.number().int().min(0).default(0),
  discount_note: z.string().max(200).optional().nullable(),
  tax_cents: z.number().int().min(0).default(0),
  customer_message: z.string().max(2000).optional().nullable(),
  internal_notes: z.string().max(2000).optional().nullable(),
  expires_days: z.number().int().min(1).max(90).default(14),
  surface_type: z.enum(["dirt", "grass", "concrete", "paver", "asphalt", "other"]).optional().nullable(),
  needs_power_supply: z.boolean().optional().nullable(),
  damage_protection_offered: z.boolean().default(false),
  damage_protection_cents: z.number().int().min(0).default(0),
  waiver_required: z.boolean().default(true),
  tax_exempt: z.boolean().default(false),
  tax_manual_override: z.boolean().default(false),
});

function computeTotals(items: any[], discount_cents: number, tax_cents: number) {
  const lineItems = items.map((it) => ({
    ...it,
    line_total_cents: it.unit_price_cents * it.quantity,
  }));
  const subtotal = lineItems.reduce((s, it) => s + it.line_total_cents, 0);
  const total = Math.max(0, subtotal - discount_cents + tax_cents);
  return { lineItems, subtotal, total };
}

export async function createQuote(input: z.infer<typeof QuoteInputSchema>) {
  const me = await requireAdmin();
  const parsed = QuoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = createAdminClient();
  const tenantId = getCurrentTenantId();

  // Generate quote number + token. Number is tenant-scoped to avoid
  // collisions across tenants and uses MAX+1 (not count) so deletes
  // don't regenerate existing numbers.
  const { data: tokRow } = await supabase.rpc("new_quote_token");

  // Retry up to 3 times to handle the rare race condition where two
  // simultaneous inserts compute the same MAX before either commits.
  let numRow: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase.rpc("next_quote_number", { p_tenant_id: tenantId });
    numRow = data;
    // Check the number isn't already taken by a concurrent insert
    const { data: existing } = await supabase
      .from("quotes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("quote_number", numRow)
      .maybeSingle();
    if (!existing) break;
  }

  const { lineItems, subtotal, total } = computeTotals(
    parsed.data.line_items,
    parsed.data.discount_cents,
    parsed.data.tax_cents,
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expires_days);

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      quote_number: numRow,
      token: tokRow,
      customer_first_name: parsed.data.customer_first_name,
      customer_last_name: parsed.data.customer_last_name,
      customer_company: parsed.data.customer_company,
      customer_email: parsed.data.customer_email.toLowerCase().trim(),
      customer_phone: parsed.data.customer_phone,
      customer_address: parsed.data.customer_address,
      event_date: parsed.data.event_date,
      event_end_date: parsed.data.event_end_date,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      line_items: lineItems,
      subtotal_cents: subtotal,
      discount_cents: parsed.data.discount_cents,
      discount_note: parsed.data.discount_note,
      tax_cents: parsed.data.tax_cents,
      total_cents: total,
      customer_message: parsed.data.customer_message,
      internal_notes: parsed.data.internal_notes,
      surface_type: parsed.data.surface_type ?? null,
      needs_power_supply: parsed.data.needs_power_supply ?? null,
      damage_protection_offered: parsed.data.damage_protection_offered,
      damage_protection_cents: parsed.data.damage_protection_offered
        ? parsed.data.damage_protection_cents
        : 0,
      waiver_required: parsed.data.waiver_required,
      tax_exempt: parsed.data.tax_exempt,
      tax_manual_override: parsed.data.tax_manual_override,
      expires_at: expiresAt.toISOString(),
      created_by: me.id,
      status: "draft",
    })
    .select("id, token, quote_number")
    .single();

  if (error) return { error: error.message };

  // Save the customer for /admin/customers + future portal access.
  // Best-effort — quote creation should not fail if this errors.
  try {
    const { createCustomerManually } = await import("@/app/admin/customers/new/actions");
    await createCustomerManually({
      email: parsed.data.customer_email.toLowerCase().trim(),
      first_name: parsed.data.customer_first_name,
      last_name: parsed.data.customer_last_name,
      phone: parsed.data.customer_phone,
      send_invite: false, // customer gets the quote email separately
    });
  } catch (e) {
    console.error("[quote → customer sync failed, non-fatal]", e);
  }

  revalidatePath("/admin/quotes");
  revalidatePath("/admin/customers");
  return { success: true, quote };
}

export async function updateQuote(id: string, input: z.infer<typeof QuoteInputSchema>) {
  await requireAdmin();
  const parsed = QuoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = createAdminClient();

  // Can only edit drafts
  const { data: existing } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Quote not found" };
  if (existing.status !== "draft") {
    return { error: "Can only edit quotes in draft status. Cancel and create a new one if needed." };
  }

  const { lineItems, subtotal, total } = computeTotals(
    parsed.data.line_items,
    parsed.data.discount_cents,
    parsed.data.tax_cents,
  );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expires_days);

  const { error } = await supabase
    .from("quotes")
    .update({
      customer_first_name: parsed.data.customer_first_name,
      customer_last_name: parsed.data.customer_last_name,
      customer_company: parsed.data.customer_company,
      customer_email: parsed.data.customer_email.toLowerCase().trim(),
      customer_phone: parsed.data.customer_phone,
      customer_address: parsed.data.customer_address,
      event_date: parsed.data.event_date,
      event_end_date: parsed.data.event_end_date,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      line_items: lineItems,
      subtotal_cents: subtotal,
      discount_cents: parsed.data.discount_cents,
      discount_note: parsed.data.discount_note,
      tax_cents: parsed.data.tax_cents,
      total_cents: total,
      customer_message: parsed.data.customer_message,
      internal_notes: parsed.data.internal_notes,
      surface_type: parsed.data.surface_type ?? null,
      needs_power_supply: parsed.data.needs_power_supply ?? null,
      damage_protection_offered: parsed.data.damage_protection_offered,
      damage_protection_cents: parsed.data.damage_protection_offered
        ? parsed.data.damage_protection_cents
        : 0,
      waiver_required: parsed.data.waiver_required,
      tax_exempt: parsed.data.tax_exempt,
      tax_manual_override: parsed.data.tax_manual_override,
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { success: true };
}

/** Internal: deliver the quote email + fire the GHL webhook for a quote
 *  that's already been persisted. Used by sendQuote (first send) and
 *  resendQuote (subsequent re-sends). */
async function deliverQuoteEmail(q: any) {
  const supabase = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun.com";
  const quoteUrl = `${baseUrl}/quotes/${q.token}`;

  // 1. Best-effort GHL webhook (for CRM sync — contact tag/notes/custom fields)
  // Per-tenant GHL config — agency model. Each tenant has their own sub-account
  // Location + webhook URLs. Skip if not configured for this tenant.
  const { getTenantGhlConfig } = await import("@/lib/ghl/tenant-config");
  const ghlConfig = await getTenantGhlConfig((q as any).tenant_id);
  const webhookUrl = ghlConfig?.quote_webhook_url || null;
  if (!ghlConfig?.location_id) {
    Sentry.captureMessage("GHL quote push skipped — no tenant location", {
      level: "info",
      tags: { area: "ghl", tenant_id: (q as any).tenant_id || "" },
      extra: { reason: "no_location" },
    });
  } else if (!webhookUrl) {
    Sentry.captureMessage("GHL quote push skipped — no quote webhook URL", {
      level: "info",
      tags: { area: "ghl", tenant_id: (q as any).tenant_id || "" },
      extra: { reason: "no_quote_webhook_url" },
    });
  }
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteNumber: q.quote_number,
          firstName: q.customer_first_name,
          lastName: q.customer_last_name,
          email: q.customer_email,
          phone: q.customer_phone,
          eventDate: q.event_date,
          eventEndDate: q.event_end_date,
          total: Math.round(q.total_cents / 100),
          quoteUrl,
          message: q.customer_message,
          source: "quote-sent",
        }),
      });
    } catch {
      // ignore — quote is marked sent anyway
    }
  }

  // 2. Send the actual email via Resend (DB template first, fallback to hardcoded)
  if (isEmailConfigured()) {
    const expiresFormatted = q.expires_at
      ? new Date(q.expires_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "";

    // Tenant's "important tips" — appended to the email body so customers
    // see payment / setup / cancellation policies before approving.
    const { data: tipsRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "important_tips")
      .maybeSingle();
    const importantTipsText = String(tipsRow?.value || "").trim();

    const tenantEmail = await getTenantEmailConfig((q as any).tenant_id);
    if (!tenantEmail) {
      Sentry.captureMessage("Tenant email skipped — no custom domain configured", {
        level: "warning",
        tags: { tenant_id: (q as any).tenant_id || "", area: "tenant-email" },
      });
      return { quote_url: quoteUrl };
    }
    const r = await sendTemplated({
      key: "quote_sent",
      to: q.customer_email,
      from: tenantEmail.from,
      replyTo: tenantEmail.replyTo,
      vars: {
        firstName: q.customer_first_name,
        quoteNumber: q.quote_number,
        eventDate: formatDateUS(q.event_date),
        eventEndDate: formatDateUS(q.event_end_date),
        totalDollars: (q.total_cents / 100).toFixed(2),
        message: q.customer_message || "",
        quoteUrl,
        expiresAtFormatted: expiresFormatted,
        importantTips: importantTipsText,
        importantTipsHtml: importantTipsText
          ? importantTipsText.replace(/\n/g, "<br>")
          : "",
      },
      fallback: async () => {
        const tenant = await getTenantInfo((q as any).tenant_id);
        return renderQuoteEmail({
          firstName: q.customer_first_name,
          quoteNumber: q.quote_number,
          quoteUrl,
          total: q.total_cents,
          eventDate: formatDateUS(q.event_date),
          eventEndDate: formatDateUS(q.event_end_date),
          message: q.customer_message,
          expiresAt: q.expires_at,
          brand: tenantToEmailBrand(tenant),
        });
      },
      tags: [
        { name: "type", value: "quote_sent" },
        { name: "quote_number", value: q.quote_number },
      ],
    });
    if (!r.ok) {
      console.error("[Resend quote send failed]", r.error);
    }
  }

  return { quote_url: quoteUrl };
}

/** Mark a draft quote as sent + fire GHL + send the customer email. */
export async function sendQuote(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: q } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();
  if (!q) return { error: "Quote not found" };
  if (q.status !== "draft") return { error: "Only draft quotes can be sent" };

  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  const { quote_url } = await deliverQuoteEmail(q);

  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { success: true, quote_url };
}

/** Resend the quote email — works for any non-converted, non-cancelled quote.
 *  Doesn't change status (keeps approved/viewed where they are) but updates
 *  sent_at so admin can see when the last delivery happened. */
export async function resendQuote(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: q } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();
  if (!q) return { error: "Quote not found" };
  if (q.status === "draft") {
    return { error: "Quote is a draft — use Send instead" };
  }
  if (q.status === "converted") {
    return { error: "Quote was already paid — nothing to resend" };
  }
  if (q.status === "declined") {
    return { error: "Quote was declined by the customer" };
  }

  // Update sent_at so admin sees the last resend timestamp
  await supabase
    .from("quotes")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);

  const { quote_url } = await deliverQuoteEmail(q);

  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { success: true, quote_url };
}

export async function cancelQuote(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: q } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", id)
    .single();
  if (!q) return { error: "Quote not found" };
  if (q.status === "converted") return { error: "Cannot cancel a converted quote" };

  const { error } = await supabase
    .from("quotes")
    .update({ status: "expired" })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { success: true };
}

/** Regenerate the Stripe PaymentIntent for an approved-but-unpaid quote.
 *  Useful when the customer hits an error mid-payment and the original
 *  intent is in a bad state, or when the 24h hold expired.
 *  - Cancels the old intent (best-effort, doesn't fail if already gone).
 *  - Creates a fresh intent with the same amount + metadata.
 *  - Resets booking hold_expires_at to +24h.
 *  Returns the quote URL the admin can re-send to the customer. */
export async function regeneratePaymentLink(quoteId: string): Promise<
  { success: true; quote_url: string; payment_intent_id: string }
  | { error: string }
> {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data: quote } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();
    if (!quote) return { error: "Quote not found" };

    if (quote.status === "converted") {
      return { error: "Quote already paid — no need to regenerate" };
    }
    if (quote.status !== "approved" || !quote.converted_booking_id) {
      return { error: "Quote must be approved (customer accepted) before regenerating the payment link" };
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, total_amount, stripe_payment_status, stripe_payment_intent_id, product_name")
      .eq("id", quote.converted_booking_id)
      .single();
    if (!booking) return { error: "Booking row not found" };

    if (booking.stripe_payment_status === "paid") {
      return { error: "Booking already paid — refresh the page" };
    }

    if (!isStripeConfigured()) {
      return { error: "Stripe not configured for this tenant" };
    }

    const stripe = getStripe();

    // Cancel the old intent if it exists (best-effort — don't fail the action)
    if (booking.stripe_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
      } catch (e: any) {
        // Already cancelled / succeeded / not found — fine, move on
        console.warn("[regeneratePaymentLink] old intent cancel failed (non-fatal):", e?.message);
      }
    }

    // Create a fresh intent with the current booking amount
    const intent = await stripe.paymentIntents.create({
      amount: Number(booking.total_amount),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      description: `Quote ${quote.quote_number} — ${booking.product_name} (regenerated)`,
      metadata: {
        booking_id: booking.id,
        tenant_id: quote.tenant_id,
        quote_id: quote.id,
        quote_number: quote.quote_number,
        customer_email: quote.customer_email,
        regenerated: "true",
      },
      receipt_email: quote.customer_email,
    });

    // Reset the hold so the customer has 24h again
    const newHold = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
    await supabase
      .from("bookings")
      .update({
        stripe_payment_intent_id: intent.id,
        hold_expires_at: newHold,
      })
      .eq("id", booking.id);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun.com";
    const quoteUrl = `${baseUrl}/quotes/${quote.token}`;

    revalidatePath(`/admin/quotes/${quoteId}`);
    revalidatePath(`/quotes/${quote.token}`);
    return { success: true, quote_url: quoteUrl, payment_intent_id: intent.id };
  } catch (e: any) {
    console.error("regeneratePaymentLink threw:", e);
    return { error: e?.message || String(e) };
  }
}

export async function deleteQuote(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: q } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", id)
    .single();
  if (!q) return { error: "Quote not found" };
  if (q.status === "converted") return { error: "Cannot delete a converted quote — it created a booking" };

  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/quotes");
  return { success: true };
}
