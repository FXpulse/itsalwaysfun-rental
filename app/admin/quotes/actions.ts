"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const LineItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  quantity: z.number().int().min(1),
  unit_price_cents: z.number().int().min(0),
});

const QuoteInputSchema = z.object({
  customer_first_name: z.string().min(1).max(100),
  customer_last_name: z.string().min(1).max(100),
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

  // Generate quote number + token
  const { data: numRow } = await supabase.rpc("next_quote_number");
  const { data: tokRow } = await supabase.rpc("new_quote_token");

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
      expires_at: expiresAt.toISOString(),
      created_by: me.id,
      status: "draft",
    })
    .select("id, token, quote_number")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/admin/quotes");
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
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { success: true };
}

/** Mark as sent. Optionally fire GHL webhook with the quote link.
 *  Even without webhook config, this marks the quote as sent so admin
 *  can copy the link manually. */
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

  // Best-effort GHL webhook (optional). If GHL_QUOTE_WEBHOOK_URL is set,
  // fire it so a GHL workflow can send the email.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
  const quoteUrl = `${baseUrl}/quotes/${q.token}`;

  const webhookUrl = process.env.GHL_QUOTE_WEBHOOK_URL;
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

  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${id}`);
  return { success: true, quote_url: quoteUrl };
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
