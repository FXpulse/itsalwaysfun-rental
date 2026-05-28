// POST /api/webhooks/ghl
// Receives booking form submission from GHL.
// Validates shared-secret header, creates booking + Payment Intent, returns checkout info.
//
// GHL webhook configuration:
//   URL: https://YOUR_VERCEL_URL.vercel.app/api/webhooks/ghl
//   Custom Header: x-ghl-secret = (your GHL_WEBHOOK_SECRET env value)
//
// Expected payload from GHL (custom fields mapped to webhook):
// {
//   contact: { firstName, lastName, email, phone, address1 },
//   custom_fields: { event_date, start_time, end_time, product_slug },
//   opportunity_id?: string
// }

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  // Required: identifies which tenant this booking belongs to. Either
  // the tenant_id UUID (preferred) or the tenant_slug (for legacy GHL
  // forms that only have the slug). At least one must be provided.
  tenant_id: z.string().uuid().optional(),
  tenant_slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  contact: z.object({
    id: z.string().optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().nullable(),
    address1: z.string().optional().nullable(),
  }),
  custom_fields: z.object({
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().optional().nullable(),
    end_time: z.string().optional().nullable(),
    product_slug: z.string().regex(/^[a-z0-9-]+$/),
  }),
  opportunity_id: z.string().optional().nullable(),
}).refine(
  (d) => !!(d.tenant_id || d.tenant_slug),
  {
    message: "tenant_id (UUID) or tenant_slug is required so the booking lands in the right tenant",
  },
);

export async function POST(request: Request) {
  // 1. Validate shared secret
  const expectedSecret = process.env.GHL_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured on server" },
      { status: 500 }
    );
  }
  const providedSecret = headers().get("x-ghl-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient({ unscoped: true });

  // 3. Resolve tenant — required for multi-tenant isolation. UUID wins
  // when both are provided.
  let tenantId: string | null = parsed.data.tenant_id || null;
  if (!tenantId && parsed.data.tenant_slug) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", parsed.data.tenant_slug)
      .maybeSingle();
    tenantId = (tenant as any)?.id || null;
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Unknown tenant — verify tenant_id or tenant_slug in payload" },
      { status: 404 },
    );
  }

  // 4. Resolve product within the tenant
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, name, slug, price_per_day, stock, is_active, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("slug", parsed.data.custom_fields.product_slug)
    .maybeSingle();

  if (prodErr || !product || !product.is_active) {
    return NextResponse.json({ error: "Product not found or inactive" }, { status: 404 });
  }

  // 5. Availability check (date)
  const date = parsed.data.custom_fields.event_date;
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("reason")
    .eq("product_id", product.id)
    .eq("blocked_date", date)
    .maybeSingle();
  if (blocked) {
    return NextResponse.json({ error: "Date blocked", reason: blocked.reason }, { status: 409 });
  }

  const nowISO = new Date().toISOString();
  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("id, booking_status, hold_expires_at")
    .eq("tenant_id", tenantId)
    .eq("product_id", product.id)
    .eq("event_date", date)
    .in("booking_status", ["pending_payment", "confirmed", "delivered"]);

  const active = (existingBookings || []).filter((b) => {
    if (b.booking_status !== "pending_payment") return true;
    if (!b.hold_expires_at) return true;
    return b.hold_expires_at > nowISO;
  });

  if (active.length >= product.stock) {
    return NextResponse.json({ error: "Already booked" }, { status: 409 });
  }

  // 6. Create booking — EXPLICIT tenant_id (never trust DB default)
  const holdExpiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .insert({
      tenant_id: tenantId,
      ghl_contact_id: parsed.data.contact.id || null,
      ghl_opportunity_id: parsed.data.opportunity_id || null,
      customer_first_name: parsed.data.contact.firstName,
      customer_last_name: parsed.data.contact.lastName,
      customer_email: parsed.data.contact.email,
      customer_phone: parsed.data.contact.phone || null,
      customer_address: parsed.data.contact.address1 || null,
      event_date: date,
      start_time: parsed.data.custom_fields.start_time || null,
      end_time: parsed.data.custom_fields.end_time || null,
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

  // 6. Create Stripe Payment Intent (100% upfront)
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
          customer_email: parsed.data.contact.email,
          source: "ghl_webhook",
        },
        receipt_email: parsed.data.contact.email,
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

  return NextResponse.json({
    booking_id: booking.id,
    hold_expires_at: holdExpiresAt,
    amount: product.price_per_day,
    currency: "usd",
    product_name: product.name,
    client_secret: clientSecret,
    payment_intent_id: paymentIntentId,
  });
}
