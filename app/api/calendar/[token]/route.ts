// GET /api/calendar/<token>.ics — public ICS feed authenticated by URL token.
// Calendar apps poll this every 1-24h to refresh bookings.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const token = (params.token || "").replace(/\.ics$/, "").trim();
  if (!token || token.length < 16) {
    return new NextResponse("Invalid feed token", { status: 401 });
  }

  const supabase = createAdminClient({ unscoped: true });
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, business_name, slug")
    .eq("calendar_feed_token", token)
    .maybeSingle();
  if (!tenant) return new NextResponse("Invalid feed token", { status: 401 });

  // Load future + recent past bookings
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, customer_first_name, customer_last_name, customer_phone, event_date, delivery_time, pickup_time, address, city, state, zip, notes, total_cents, booking_status")
    .eq("tenant_id", tenant.id)
    .gte("event_date", since)
    .neq("booking_status", "cancelled")
    .order("event_date");

  const items = (bookings as any[]) || [];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//RentalFlow//${escapeIcs(tenant.slug)}//EN`,
    `X-WR-CALNAME:${escapeIcs(tenant.business_name)} bookings`,
    `X-WR-CALDESC:Live bookings feed from RentalFlow`,
    "X-WR-TIMEZONE:America/New_York",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    "METHOD:PUBLISH",
  ];

  for (const b of items) {
    const start = parseDateTime(b.event_date, b.delivery_time);
    const end = parseDateTime(b.event_date, b.pickup_time) || addHours(start, 4);
    const customer = [b.customer_first_name, b.customer_last_name].filter(Boolean).join(" ") || "(no name)";
    const summary = `Booking #${b.id.slice(0, 8)} — ${customer}`;
    const loc = [b.address, b.city, b.state, b.zip].filter(Boolean).join(", ");
    const desc = [
      `Customer: ${customer}`,
      b.customer_phone ? `Phone: ${b.customer_phone}` : null,
      b.total_cents ? `Total: $${(b.total_cents / 100).toFixed(2)}` : null,
      b.notes ? `Notes: ${b.notes}` : null,
      `Open: https://getrentalflow.com/admin/bookings/${b.id}`,
    ].filter(Boolean).join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:booking-${b.id}@rentalflow`);
    lines.push(`DTSTAMP:${formatIcsDateTime(new Date())}`);
    lines.push(`DTSTART:${formatIcsDateTime(start)}`);
    lines.push(`DTEND:${formatIcsDateTime(end)}`);
    lines.push(`SUMMARY:${escapeIcs(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcs(desc)}`);
    if (loc) lines.push(`LOCATION:${escapeIcs(loc)}`);
    lines.push(`STATUS:CONFIRMED`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="${tenant.slug}-bookings.ics"`,
    },
  });
}

function parseDateTime(date: string, time: string | null): Date {
  if (!time) return new Date(`${date}T09:00:00-04:00`);
  // Time format may be "14:00:00" or "14:00"
  const normalized = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalized}-04:00`);
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3_600_000);
}

function formatIcsDateTime(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
