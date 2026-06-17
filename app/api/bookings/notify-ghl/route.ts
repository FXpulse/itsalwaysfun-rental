// POST /api/bookings/notify-ghl
// Server-side fire-and-forget to GHL booking webhook.
// Called from client after a booking is created — keeps the per-tenant
// webhook URL hidden server-side and lets us scope the push to the right
// tenant sub-account.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { getTenantGhlConfig } from "@/lib/ghl/tenant-config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const tenantId = getCurrentTenantId();
  const ghlConfig = await getTenantGhlConfig(tenantId);

  if (!ghlConfig) {
    Sentry.addBreadcrumb({
      category: "ghl",
      message: "GHL push skipped — tenant has no location_id",
      level: "info",
      data: { reason: "no_location" },
    });
    Sentry.captureMessage("GHL push skipped — no tenant location", {
      level: "info",
      tags: { area: "ghl", tenant_id: tenantId || "" },
      extra: { reason: "no_location" },
    });
    return NextResponse.json({ ok: false, reason: "no_location" });
  }

  const webhookUrl = ghlConfig.booking_webhook_url;
  if (!webhookUrl) {
    Sentry.addBreadcrumb({
      category: "ghl",
      message: "GHL webhook skipped — no booking_webhook_url for tenant",
      level: "info",
      data: { reason: "no_booking_webhook_url" },
    });
    Sentry.captureMessage("GHL booking webhook skipped — no URL configured", {
      level: "info",
      tags: { area: "ghl", tenant_id: tenantId || "" },
      extra: { reason: "no_booking_webhook_url" },
    });
    return NextResponse.json({ ok: false, reason: "no_booking_webhook_url" });
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
