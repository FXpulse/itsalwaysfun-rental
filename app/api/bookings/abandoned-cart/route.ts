// POST /api/bookings/abandoned-cart
// Fires GHL abandoned cart webhook to trigger recovery sequence.
// Client-side timer in BookingWizard / cart context calls this after
// 30 min of inactivity when customer entered contact info but didn't submit.

import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  product: z.string().max(200),
  productSlug: z.string().max(100),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalPrice: z.number().int().min(0),
  source: z.string().optional(),
});

export async function POST(request: Request) {
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
      { status: 400 }
    );
  }

  const webhookUrl = process.env.GHL_ABANDONED_CART_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, reason: "no_webhook_configured" });
  }

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed.data,
        source: parsed.data.source || "abandoned-cart",
      }),
    });
    return NextResponse.json({ ok: r.ok, status: r.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e.message });
  }
}
