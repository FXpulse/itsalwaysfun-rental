// POST /api/contact
// Fires GHL booking webhook with contact-message payload (general inquiry, not a booking).
// Workflow 1 in GHL handles creating the contact + sending notifications.

import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  message: z.string().min(1).max(5000),
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

  const webhookUrl = process.env.GHL_BOOKING_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Contact form not configured (missing webhook)" },
      { status: 500 }
    );
  }

  try {
    const ghlPayload = {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone || "",
      notes: parsed.data.message,
      source: parsed.data.source || "website-contact",
      // Flag so admin can distinguish contact form from booking form
      contactType: "general_inquiry",
    };

    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ghlPayload),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("[Contact GHL webhook failed]", r.status, text);
      return NextResponse.json(
        { error: "Failed to deliver message" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[Contact form error]", e);
    return NextResponse.json({ error: e.message || "Network error" }, { status: 500 });
  }
}
