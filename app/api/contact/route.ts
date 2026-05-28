// POST /api/contact
// Triple-redundant delivery:
//  1. Persist to contact_messages (source of truth — never lose a message)
//  2. Email admin via Resend (instant inbox notification)
//  3. Fire GHL webhook (CRM sync — workflow 1 creates contact + tags)
//
// If 1 succeeds we return ok=true even if 2/3 fail (the message is safely
// stored and admin will see it in /admin/inbox).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  message: z.string().min(1).max(5000),
  source: z.string().optional(),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  // Rate limit: 5 submissions per IP per 5-minute window. Fails open
  // when KV isn't configured (local dev).
  const ip = clientIp(request);
  const rl = await rateLimit(`contact:${ip}`, { max: 5, windowSeconds: 300 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

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

  const data = parsed.data;
  const supabase = createAdminClient();

  // 1. Persist to DB — source of truth
  const { data: row, error: insertErr } = await supabase
    .from("contact_messages")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email.trim().toLowerCase(),
      phone: data.phone || null,
      message: data.message,
      source: data.source || "website-contact",
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[Contact insert failed]", insertErr);
    return NextResponse.json(
      { error: "Could not save message — please call us at (904) 584-3047" },
      { status: 500 },
    );
  }

  // 2. Email admin via Resend (best-effort). Failures logged to email_send_error
  // so they're visible in /admin/inbox (don't fail the request — the DB row is
  // the source of truth).
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@itsalwaysfun.com";
  if (!isEmailConfigured()) {
    await supabase
      .from("contact_messages")
      .update({
        email_send_error: `Resend not configured: missing ${process.env.RESEND_API_KEY ? "" : "RESEND_API_KEY "}${process.env.EMAIL_FROM ? "" : "EMAIL_FROM"}`.trim(),
      })
      .eq("id", row.id);
  } else {
    try {
      const res = await sendEmail({
        to: adminEmail,
        replyTo: data.email,                       // reply goes straight to customer
        subject: `📨 New contact form: ${data.firstName} ${data.lastName}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;">
<h2 style="color:#1a1a6e;margin-bottom:8px;">New website contact</h2>
<p style="color:#64748b;font-size:13px;margin-top:0;">Source: ${escapeHtml(data.source || "website-contact")}</p>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
  <tr><td style="padding:6px 0;color:#64748b;width:90px;">Name</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</td></tr>
  <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
  ${data.phone ? `<tr><td style="padding:6px 0;color:#64748b;">Phone</td><td style="padding:6px 0;"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td></tr>` : ""}
</table>
<div style="background:#f8fafc;border-left:4px solid #1a1a6e;padding:12px 16px;border-radius:4px;margin-bottom:16px;">
  <p style="margin:0;white-space:pre-wrap;line-height:1.5;">${escapeHtml(data.message)}</p>
</div>
<p style="color:#64748b;font-size:12px;">Hit Reply to respond directly to ${escapeHtml(data.email)}.</p>
<p style="color:#94a3b8;font-size:11px;">Sent to: ${escapeHtml(adminEmail)}</p>
</div>`,
        text: `New contact from ${data.firstName} ${data.lastName}\nEmail: ${data.email}\n${data.phone ? `Phone: ${data.phone}\n` : ""}\nMessage:\n${data.message}`,
        tags: [{ name: "type", value: "contact_form" }],
      });
      if (res.ok) {
        await supabase
          .from("contact_messages")
          .update({
            emailed_to_admin_at: new Date().toISOString(),
            email_send_error: null,
          })
          .eq("id", row.id);
      } else {
        console.error("[Contact email failed]", res.error);
        await supabase
          .from("contact_messages")
          .update({
            email_send_error: `to:${adminEmail} → ${(res.error || "unknown").substring(0, 400)}`,
          })
          .eq("id", row.id);
      }
    } catch (e: any) {
      console.error("[Contact email exception]", e);
      await supabase
        .from("contact_messages")
        .update({
          email_send_error: `to:${adminEmail} → exception: ${(e.message || "unknown").substring(0, 400)}`,
        })
        .eq("id", row.id);
    }
  }

  // 3. Fire GHL webhook (best-effort, non-blocking failure)
  const webhookUrl = process.env.GHL_BOOKING_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || "",
          notes: data.message,
          source: data.source || "website-contact",
          contactType: "general_inquiry",
        }),
      });
      if (r.ok) {
        await supabase
          .from("contact_messages")
          .update({ ghl_webhook_fired_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        const text = await r.text();
        console.error("[Contact GHL webhook failed]", r.status, text);
        await supabase
          .from("contact_messages")
          .update({ ghl_webhook_error: `${r.status}: ${text.substring(0, 300)}` })
          .eq("id", row.id);
      }
    } catch (e: any) {
      console.error("[Contact GHL webhook exception]", e);
      await supabase
        .from("contact_messages")
        .update({ ghl_webhook_error: e.message?.substring(0, 300) || "exception" })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
