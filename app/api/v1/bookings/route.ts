// /api/v1/bookings — list (GET) or create draft (POST) bookings for the
// authenticated tenant. Auth: Authorization: Bearer rfk_...
// Scopes: bookings:read for GET, bookings:write for POST

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "bookings:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
  const since = searchParams.get("since");          // ISO date
  const status = searchParams.get("status");        // confirmed / pending / etc

  const supabase = createAdminClient({ unscoped: true });
  let query = supabase
    .from("bookings")
    .select("id, status, customer_first_name, customer_last_name, customer_email, customer_phone, event_date, delivery_time, pickup_time, total_cents, paid_cents, address, city, state, zip, notes, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (since) query = query.gte("created_at", since);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data || [], count: data?.length || 0 });
}

const CreateBookingSchema = z.object({
  customer_first_name: z.string().min(1).max(80),
  customer_last_name: z.string().min(1).max(80),
  customer_email: z.string().email(),
  customer_phone: z.string().max(40).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  delivery_time: z.string().optional(),
  pickup_time: z.string().optional(),
  product_id: z.string().uuid(),
  total_amount: z.number().int().nonnegative(),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  state: z.string().max(40).optional(),
  zip: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  external_ref: z.string().max(120).optional(),     // your system's ID for this booking
});

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req, "bookings:write");
  if (auth instanceof NextResponse) return auth;

  let raw: unknown;
  try { raw = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = CreateBookingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.errors[0].message, path: parsed.error.errors[0].path },
      { status: 400 },
    );
  }

  const supabase = createAdminClient({ unscoped: true });
  // Verify product belongs to this tenant
  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", parsed.data.product_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "product_not_found_for_tenant" }, { status: 404 });
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      tenant_id: auth.tenant_id,
      customer_first_name: parsed.data.customer_first_name,
      customer_last_name: parsed.data.customer_last_name,
      customer_email: parsed.data.customer_email,
      customer_phone: parsed.data.customer_phone || null,
      event_date: parsed.data.event_date,
      event_end_date: parsed.data.event_end_date || parsed.data.event_date,
      start_time: parsed.data.delivery_time || null,
      end_time: parsed.data.pickup_time || null,
      product_id: product.id,
      product_name: product.name,
      total_amount: parsed.data.total_amount,
      customer_address: [parsed.data.address, parsed.data.city, parsed.data.state, parsed.data.zip].filter(Boolean).join(", ") || null,
      notes: [parsed.data.notes, parsed.data.external_ref ? `external_ref: ${parsed.data.external_ref}` : null].filter(Boolean).join("\n") || null,
      stripe_payment_status: "pending",
      booking_status: "pending_payment",
      // Mark as API-created so the UI can distinguish if needed
    })
    .select("id, event_date, product_name, total_amount, booking_status, created_at")
    .single();
  if (error || !booking) {
    return NextResponse.json({ error: "create_failed", detail: error?.message }, { status: 500 });
  }

  // Fire webhook (fire-and-forget)
  dispatchWebhookEvent({
    tenant_id: auth.tenant_id,
    event: "booking.created",
    payload: {
      booking_id: booking.id,
      customer_first_name: parsed.data.customer_first_name,
      customer_last_name: parsed.data.customer_last_name,
      customer_email: parsed.data.customer_email,
      event_date: parsed.data.event_date,
      product_name: product.name,
      total_amount: parsed.data.total_amount,
      source: "api",
    },
  }).catch((e) => console.error("[webhook dispatch failed]", e?.message));

  return NextResponse.json({ booking, created: true }, { status: 201 });
}
