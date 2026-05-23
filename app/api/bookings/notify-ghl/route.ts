// POST /api/bookings/notify-ghl
// Server-side fire-and-forget to GHL booking webhook.
// Called from client after a booking is created — keeps GHL_BOOKING_WEBHOOK_URL hidden server-side.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookUrl = process.env.GHL_BOOKING_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, reason: "no_webhook_configured" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: r.ok, status: r.status });
  } catch (e: any) {
    // Don't surface error to client — booking already exists in our DB
    console.error("[GHL webhook failed]", e);
    return NextResponse.json({ ok: false, reason: e.message });
  }
}
