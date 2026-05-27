// POST /api/email/inbound
// Receives parsed emails forwarded from a Cloudflare Email Worker (or any
// service that can POST parsed email JSON). Saves to contact_messages so
// they appear in /admin/inbox alongside form submissions.
//
// Auth: shared secret in header `x-inbound-secret` matched against
// INBOUND_EMAIL_SECRET env var. Set the same secret in the Cloudflare Worker.
//
// Expected payload:
// {
//   "from": "jane@example.com",          // required
//   "from_name": "Jane Doe",             // optional — parsed from RFC2822 if Worker can
//   "to": "bookings@itsalwaysfun.com",   // optional, for logging
//   "subject": "Question about the bouncer",
//   "text": "plain text body",            // preferred
//   "html": "...",                        // fallback if no text
//   "received_at": "2026-05-26T14:00:00Z" // optional
// }

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  from: z.string().email(),
  from_name: z.string().max(200).optional().nullable(),
  to: z.string().max(200).optional().nullable(),
  subject: z.string().max(500).optional().nullable(),
  text: z.string().max(100000).optional().nullable(),
  html: z.string().max(500000).optional().nullable(),
  received_at: z.string().optional().nullable(),
});

/** Strip HTML tags as a basic fallback when there's no plain text. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split a name into first + last. Fallback to email local-part. */
function splitName(rawName: string | null | undefined, email: string): { first: string; last: string } {
  const fallback = email.split("@")[0] || "Unknown";
  const name = (rawName || "").trim();
  if (!name) {
    return { first: fallback, last: "" };
  }
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export async function POST(request: Request) {
  // Auth check
  const expectedSecret = process.env.INBOUND_EMAIL_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Inbound email not configured (set INBOUND_EMAIL_SECRET)" },
      { status: 503 },
    );
  }
  const provided = request.headers.get("x-inbound-secret");
  if (provided !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      { status: 400 },
    );
  }

  const data = parsed.data;
  const messageBody = (data.text || (data.html ? htmlToText(data.html) : "")).trim();
  if (!messageBody) {
    return NextResponse.json(
      { error: "Empty message body — need text or html" },
      { status: 400 },
    );
  }

  const { first, last } = splitName(data.from_name, data.from);
  const supabase = createAdminClient({ unscoped: true });

  const { data: row, error: insertErr } = await supabase
    .from("contact_messages")
    .insert({
      first_name: first,
      last_name: last,
      email: data.from.trim().toLowerCase(),
      phone: null,
      subject: data.subject || null,
      message: messageBody,
      source: "inbound-email",
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[Inbound email insert failed]", insertErr);
    return NextResponse.json(
      { error: "Could not save", details: insertErr?.message },
      { status: 500 },
    );
  }

  // Notify admin (same Resend flow as the contact form — alerts you immediately)
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@itsalwaysfun.com";
  if (isEmailConfigured()) {
    try {
      const res = await sendEmail({
        to: adminEmail,
        replyTo: data.from,
        subject: `📥 Email to bookings@: ${data.subject || "(no subject)"}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;">
<h2 style="color:#1a1a6e;margin-bottom:8px;">New email to bookings@itsalwaysfun.com</h2>
<p style="color:#64748b;font-size:13px;margin-top:0;">From: <strong>${first} ${last}</strong> &lt;${data.from}&gt;</p>
${data.subject ? `<p style="margin:0 0 8px;"><strong>Subject:</strong> ${data.subject}</p>` : ""}
<div style="background:#f8fafc;border-left:4px solid #1a1a6e;padding:12px 16px;border-radius:4px;margin-bottom:16px;">
  <pre style="margin:0;white-space:pre-wrap;line-height:1.5;font-family:inherit;">${messageBody}</pre>
</div>
<p style="color:#64748b;font-size:12px;">Reply directly from <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/admin/inbox">/admin/inbox</a> or hit Reply to respond to ${data.from}.</p>
</div>`,
        text: `New email from ${first} ${last} <${data.from}>${data.subject ? `\nSubject: ${data.subject}` : ""}\n\n${messageBody}`,
        tags: [{ name: "type", value: "inbound_email" }],
      });
      if (res.ok) {
        await supabase
          .from("contact_messages")
          .update({ emailed_to_admin_at: new Date().toISOString() })
          .eq("id", row.id);
      } else {
        await supabase
          .from("contact_messages")
          .update({ email_send_error: res.error || "unknown" })
          .eq("id", row.id);
      }
    } catch (e: any) {
      console.error("[Inbound email admin notify failed]", e);
      await supabase
        .from("contact_messages")
        .update({ email_send_error: e.message || "exception" })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
