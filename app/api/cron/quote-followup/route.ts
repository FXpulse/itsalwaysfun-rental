// GET /api/cron/quote-followup
// Runs daily — finds quotes sent 3+ days ago that the customer hasn't
// accepted or paid yet, and sends a friendly follow-up email.
//
// Only sends ONE reminder per quote (tracked via followup_sent_at column).
// Skips: already paid, declined, expired, never sent.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getTenantInfo } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

const FOLLOWUP_DAYS = 3;

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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FOLLOWUP_DAYS);

  // Find quotes: sent (status 'sent' or 'viewed'), sent >= 3 days ago,
  // not yet followed up, not expired
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("*")
    .in("status", ["sent", "viewed"])
    .lte("sent_at", cutoff.toISOString())
    .is("followup_sent_at", null)
    .order("sent_at", { ascending: true })
    .limit(50);  // cap per run

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://itsalwaysfun-rental.vercel.app";
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const q of (quotes as any[]) || []) {
    // Skip if expired
    if (q.expires_at && new Date(q.expires_at) < new Date()) {
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
    const expiresLabel = q.expires_at
      ? new Date(q.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";

    // Look up this quote's tenant to brand the email
    const tenant = await getTenantInfo(q.tenant_id);
    const brand = tenant.business_name;
    const replyTo = tenant.owner_email || undefined;

    try {
      const res = await sendEmail({
        to: q.customer_email,
        replyTo,
        subject: `Reminder: Your quote from ${brand} is waiting`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#0f172a;">
<p>Hi ${customerName},</p>
<p>Just a friendly reminder that we sent you a quote for your event a few days ago. We don't want to let it slip through the cracks!</p>
<table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:6px;padding:16px;margin:16px 0;">
  <tr><td style="padding:6px 0;color:#64748b;width:90px;">Quote #</td><td style="padding:6px 0;font-weight:600;">${q.quote_number || q.id?.substring(0, 8)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Total</td><td style="padding:6px 0;font-weight:bold;color:#1a1a6e;font-size:18px;">$${totalDollars}</td></tr>
  ${expiresLabel ? `<tr><td style="padding:6px 0;color:#64748b;">Expires</td><td style="padding:6px 0;">${expiresLabel}</td></tr>` : ""}
</table>
<p style="text-align:center;">
  <a href="${quoteUrl}" style="background:#1a1a6e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">View and Accept Quote</a>
</p>
<p style="color:#64748b;font-size:13px;">
  Questions? Reply to this email and we'll get back to you. We can also tweak the
  package if something doesn't fit your needs — just let us know.
</p>
<p style="color:#64748b;font-size:13px;">— The ${brand} team</p>
</div>`,
        text: `Hi ${customerName},\n\nJust a reminder — your quote is waiting:\nTotal: $${totalDollars}\n${expiresLabel ? `Expires: ${expiresLabel}\n` : ""}\nView & accept: ${quoteUrl}\n\nReply if you have questions or want adjustments.\n— ${brand}`,
        tags: [{ name: "type", value: "quote_followup" }],
      });

      if (res.ok) {
        await supabase
          .from("quotes")
          .update({ followup_sent_at: new Date().toISOString() })
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
