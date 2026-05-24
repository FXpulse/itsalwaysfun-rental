// POST /api/bookings/abandoned-cart
// Fires GHL abandoned cart webhook to trigger recovery sequence.
// Client-side timer in BookingWizard / cart context calls this after
// 30 min of inactivity when customer entered contact info but didn't submit.

import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { renderAbandonedCartEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  product: z.string().max(200),
  productSlug: z.string().max(100),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  const results: any = {};

  // 1. GHL webhook (CRM sync)
  const webhookUrl = process.env.GHL_ABANDONED_CART_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          source: parsed.data.source || "abandoned-cart",
        }),
      });
      results.ghl = { ok: r.ok, status: r.status };
    } catch (e: any) {
      results.ghl = { ok: false, error: e.message };
    }
  }

  // 2. Direct email via Resend
  if (isEmailConfigured()) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
    const tmpl = renderAbandonedCartEmail({
      firstName: parsed.data.firstName,
      productName: parsed.data.product,
      eventDate: parsed.data.eventDate,
      totalPrice: Math.round(parsed.data.totalPrice * 100),
      resumeUrl: `${baseUrl}/order-by-date?product=${encodeURIComponent(parsed.data.productSlug)}`,
    });
    const r = await sendEmail({
      to: parsed.data.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
      tags: [{ name: "type", value: "abandoned_cart" }],
    });
    results.resend = { ok: r.ok, id: r.id, error: r.error };
  }

  return NextResponse.json({ ok: true, results });
}
