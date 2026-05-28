// GET /api/cron/quote-hold-reminder
// Runs hourly. Finds approved quotes whose 24h booking hold is about to
// expire (within the next ~6 hours) AND payment hasn't completed AND no
// reminder was sent yet. Emails the customer a "complete payment or you
// lose your spot" nudge.
//
// Idempotent via quotes.hold_reminder_sent_at — once set, the quote is
// skipped on subsequent runs.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantInfo } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

const REMINDER_WINDOW_HOURS = 6;

export async function GET() {
  const auth = headers().get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "email not configured",
    });
  }

  const supabase = createAdminClient({ unscoped: true });
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000);

  // Approved quotes with a booking, hold expiring soon, no reminder yet
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("status", "approved")
    .not("converted_booking_id", "is", null)
    .is("hold_reminder_sent_at", null)
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const q of (quotes as any[]) || []) {
    try {
      // Fetch the booking to check hold + payment status
      const { data: booking } = await supabase
        .from("bookings")
        .select("hold_expires_at, stripe_payment_status, booking_status")
        .eq("id", q.converted_booking_id)
        .single();

      if (!booking) {
        skipped++;
        continue;
      }

      // Skip if already paid or no longer pending payment
      if (
        booking.stripe_payment_status === "paid" ||
        booking.booking_status !== "pending_payment"
      ) {
        skipped++;
        continue;
      }

      // Skip if hold expiry isn't in the reminder window (next 6h)
      if (!booking.hold_expires_at) {
        skipped++;
        continue;
      }
      const expiresAt = new Date(booking.hold_expires_at);
      if (expiresAt <= now || expiresAt > windowEnd) {
        skipped++;
        continue;
      }

      if (!q.customer_email) {
        skipped++;
        continue;
      }

      const totalDollars = ((q.total_cents || 0) / 100).toFixed(2);
      const customerName = q.customer_first_name || "there";
      const quoteUrl = `${baseUrl}/quotes/${q.token}`;

      const hoursLeft = Math.max(
        1,
        Math.round((expiresAt.getTime() - now.getTime()) / 3600_000),
      );
      const expiryLabel = expiresAt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      const tenant = await getTenantInfo(q.tenant_id);
      const brand = tenant.business_name;
      const replyTo = tenant.owner_email || undefined;

      const res = await sendEmail({
        to: q.customer_email,
        replyTo,
        subject: `Your reservation expires in ${hoursLeft}h — complete payment to lock it in`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#0f172a;">
<p>Hi ${customerName},</p>
<p>Friendly reminder — you approved your quote with ${brand} and your reservation
is on hold, but the payment hasn't gone through yet.</p>
<p>Your hold expires <strong>${expiryLabel}</strong> (about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} from now).
If we don't receive payment by then, we can't guarantee your booking — the date
becomes available to other customers.</p>
<table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:6px;padding:16px;margin:16px 0;">
  <tr><td style="padding:6px 0;color:#64748b;width:90px;">Quote #</td><td style="padding:6px 0;font-weight:600;">${q.quote_number || q.id?.substring(0, 8)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Total due</td><td style="padding:6px 0;font-weight:bold;color:#1a1a6e;font-size:18px;">$${totalDollars}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Hold expires</td><td style="padding:6px 0;font-weight:600;color:#b45309;">${expiryLabel}</td></tr>
</table>
<p style="text-align:center;">
  <a href="${quoteUrl}" style="background:#1a1a6e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">Complete payment</a>
</p>
<p style="color:#64748b;font-size:13px;">
  Already paid? Ignore this email — it can take a few minutes to confirm.
  Need to reschedule or have questions? Just reply to this message.
</p>
<p style="color:#64748b;font-size:13px;">— The ${brand} team</p>
</div>`,
        text: `Hi ${customerName},

Reminder: your reservation with ${brand} is on hold but payment hasn't completed yet.
Your hold expires ${expiryLabel} (about ${hoursLeft}h from now).
If we don't receive payment, we can't guarantee your booking.

Quote #${q.quote_number || q.id?.substring(0, 8)}
Total due: $${totalDollars}

Complete payment: ${quoteUrl}

Already paid? Ignore this email — can take a few minutes to confirm.
— ${brand}`,
        tags: [
          { name: "type", value: "quote_hold_reminder" },
          { name: "quote_number", value: String(q.quote_number || "") },
        ],
      });

      if (res.ok) {
        await supabase
          .from("quotes")
          .update({ hold_reminder_sent_at: new Date().toISOString() })
          .eq("id", q.id);
        sent++;
      } else {
        errors.push(`Quote ${q.id}: ${res.error}`);
      }
    } catch (e: any) {
      errors.push(`Quote ${q.id}: ${e.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    found: quotes?.length || 0,
    sent,
    skipped,
    errors: errors.slice(0, 10),
  });
}
