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
  // Tenant identifier — optional. If neither is provided, we fall back to
  // deriving the tenant from the "to" address (look up by custom_domain).
  // The original Cloudflare Email Worker template didn't pass either of
  // these, so without the fallback every forwarded email returns 400.
  tenant_id: z.string().uuid().optional(),
  tenant_slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  from: z.string().email(),
  from_name: z.string().max(200).optional().nullable(),
  to: z.string().max(200).optional().nullable(),
  subject: z.string().max(500).optional().nullable(),
  text: z.string().max(100000).optional().nullable(),
  html: z.string().max(500000).optional().nullable(),
  received_at: z.string().optional().nullable(),
});

/** Decode base64 / quoted-printable MIME bodies that the Cloudflare Email
 *  Worker's basic extractor leaves un-decoded. Real emails (especially
 *  Outlook replies) come in with Content-Transfer-Encoding: base64 or
 *  quoted-printable. The worker forwards the encoded bytes as text; we
 *  decode them here so /admin/inbox shows the actual message instead of
 *  base64 gibberish. */
function decodeMimeBody(text: string): string {
  let body = text;

  // Strip leading MIME headers if the worker passed them through
  const headerEnd = body.match(/\r?\n\r?\n/);
  let headers = "";
  if (headerEnd && /Content-Type:|Content-Transfer-Encoding:/i.test(body.slice(0, headerEnd.index!))) {
    headers = body.slice(0, headerEnd.index!);
    body = body.slice(headerEnd.index! + headerEnd[0].length);
  }

  // Stop at the next MIME boundary if any
  const boundaryStop = body.match(/\r?\n--[^\r\n]+/);
  if (boundaryStop) body = body.slice(0, boundaryStop.index);

  const encoding = (headers.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1] || "").toLowerCase();
  const charset = headers.match(/charset="?([^"\s;]+)"?/i)?.[1]?.toLowerCase() || "utf-8";

  if (encoding === "base64") {
    try {
      // Strip whitespace inside the base64 blob (it can have line wraps)
      const clean = body.replace(/\s+/g, "");
      const decoded = Buffer.from(clean, "base64");
      // Best-effort charset decoding (Node supports utf-8 + latin1 natively)
      const safeCharset = ["utf-8", "utf8", "ascii", "latin1"].includes(charset) ? (charset as BufferEncoding) : "utf8";
      body = decoded.toString(safeCharset as BufferEncoding);
    } catch (e) {
      // Decoding failed — leave the original text rather than crashing
    }
  } else if (encoding === "quoted-printable") {
    // Decode RFC 2045 quoted-printable: =XX hex pairs + soft line breaks
    body = body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  return body.trim();
}

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
  // Pre-process: if the Worker forwarded raw MIME (with base64 / quoted-printable
  // encoded body) the text field still contains gibberish. Decode + clean it
  // before saving to the inbox.
  const rawText = data.text || "";
  const looksLikeRawMime = /Content-Type:\s*text/i.test(rawText) || /Content-Transfer-Encoding:/i.test(rawText);
  const cleanText = looksLikeRawMime ? decodeMimeBody(rawText) : rawText;
  const messageBody = (cleanText || (data.html ? htmlToText(data.html) : "")).trim();
  if (!messageBody) {
    return NextResponse.json(
      { error: "Empty message body — need text or html" },
      { status: 400 },
    );
  }

  const { first, last } = splitName(data.from_name, data.from);
  const supabase = createAdminClient({ unscoped: true });

  // Resolve tenant — try in order:
  //   1. tenant_id (UUID) directly
  //   2. tenant_slug → look up id
  //   3. "to" address domain → look up by custom_domain
  //   4. Fallback to the default IAF tenant so legacy worker payloads
  //      (no tenant fields, addressed at itsalwaysfun.net) still land.
  let tenantId: string | null = data.tenant_id || null;
  if (!tenantId && data.tenant_slug) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", data.tenant_slug)
      .maybeSingle();
    tenantId = (tenant as any)?.id || null;
  }
  if (!tenantId && data.to) {
    // Extract domain from a "to" like "bookings@itsalwaysfun.net" or
    // RFC2822 "Name <addr@dom>" — try both forms.
    const m = data.to.match(/@([a-z0-9.-]+)/i);
    const domain = m?.[1]?.toLowerCase();
    if (domain) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .or(`custom_domain.eq.${domain},custom_domain.eq.www.${domain}`)
        .maybeSingle();
      tenantId = (tenant as any)?.id || null;
      // Also accept .net when tenant has .com (handles the migration period
      // where .net mail is still being forwarded after the canonical switch)
      if (!tenantId && domain.endsWith(".net")) {
        const comDomain = domain.replace(/\.net$/, ".com");
        const { data: tenant2 } = await supabase
          .from("tenants")
          .select("id")
          .eq("custom_domain", comDomain)
          .maybeSingle();
        tenantId = (tenant2 as any)?.id || null;
      }
    }
  }
  if (!tenantId) {
    // Last-resort fallback — single-tenant deployments (the IAF UUID is
    // seeded by multi_tenant_foundation.sql).
    tenantId = "11111111-1111-1111-1111-111111111111";
    console.warn("[inbound-email] no tenant resolved, falling back to default IAF", { to: data.to });
  }

  const { data: row, error: insertErr } = await supabase
    .from("contact_messages")
    .insert({
      tenant_id: tenantId,
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
        subject: `📥 Inbound email: ${data.subject || "(no subject)"}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;">
<h2 style="color:#1a1a6e;margin-bottom:8px;">New inbound email</h2>
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
