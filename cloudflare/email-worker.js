/**
 * Cloudflare Email Worker — forwards emails sent to bookings@itsalwaysfun.net
 * into /admin/inbox of the rental app.
 *
 * ✅ ZERO npm dependencies — pastes directly into the Cloudflare Worker
 *    dashboard editor with no build step. Extracts from/to/subject and the
 *    raw body using built-in Email Worker APIs only.
 *
 *    If you want richer parsing later (HTML body, attachments, quoted-printable
 *    decoding, character encoding handling), swap this for the PostalMime
 *    version — but that requires installing wrangler locally and running
 *    `wrangler deploy` to bundle the npm package.
 *
 * SETUP (one time):
 *   1. Cloudflare → Email → Email Routing → enable for your domain (adds MX records)
 *   2. Workers & Pages → Create application → Create Worker.
 *      Paste this file's contents as the Worker code.
 *   3. Worker settings → Variables and Secrets → add:
 *        INBOX_WEBHOOK_URL = https://itsalwaysfun-rental.vercel.app/api/email/inbound
 *        INBOX_SECRET = <random string, e.g. `openssl rand -hex 32`>
 *   4. Vercel → Environment Variables → INBOUND_EMAIL_SECRET = <the same string>
 *      Redeploy the Vercel project.
 *   5. Cloudflare Email Routing → Routes → custom address bookings@... →
 *      Action: Send to Worker → pick this Worker.
 *   6. Send a test email from your Gmail → it should appear in /admin/inbox
 *      within ~30 seconds with a blue "Email" badge.
 *
 * 💡 Catch-all rule recommended: also route *@itsalwaysfun.net to this Worker
 *    so any address (not just bookings@) lands in the inbox.
 */

/** Read message.raw (ReadableStream) into a UTF-8 string. */
async function readRawAsText(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8").decode(merged);
}

/** Best-effort plain-text body extraction from raw MIME (no deps).
 *  Handles single-part and basic multipart/alternative. Falls back to the
 *  raw payload if structure isn't recognized — the webhook side does its
 *  own HTML stripping as a second fallback. */
function extractPlainTextBody(raw) {
  // Multipart? Find boundary param
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split("--" + boundary);
    // Prefer text/plain
    for (const part of parts) {
      if (/Content-Type:\s*text\/plain/i.test(part)) {
        const idx = part.indexOf("\r\n\r\n");
        if (idx > -1) return part.substring(idx + 4).replace(/=\r?\n/g, "").trim();
      }
    }
  }
  // Single-part: body is everything after the first blank line
  const idx = raw.indexOf("\r\n\r\n");
  if (idx > -1) return raw.substring(idx + 4).trim();
  return raw.trim();
}

/** Try to extract HTML body too, so the inbound endpoint can fall back to it. */
function extractHtmlBody(raw) {
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) return "";
  const boundary = boundaryMatch[1];
  const parts = raw.split("--" + boundary);
  for (const part of parts) {
    if (/Content-Type:\s*text\/html/i.test(part)) {
      const idx = part.indexOf("\r\n\r\n");
      if (idx > -1) return part.substring(idx + 4).replace(/=\r?\n/g, "").trim();
    }
  }
  return "";
}

/** Parse a `Name <email@host>` style address. */
function parseAddress(headerValue) {
  if (!headerValue) return { name: "", address: "" };
  const match = headerValue.match(/^(.*?)<([^>]+)>/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), address: match[2].trim() };
  }
  return { name: "", address: headerValue.trim() };
}

export default {
  async email(message, env, ctx) {
    if (!env.INBOX_WEBHOOK_URL || !env.INBOX_SECRET) {
      console.error("Worker not configured: missing INBOX_WEBHOOK_URL or INBOX_SECRET");
      return;
    }

    let raw = "";
    try {
      raw = await readRawAsText(message.raw);
    } catch (e) {
      console.error("Failed to read message body", e);
      return;
    }

    // message.from / message.to are pre-parsed addresses (no name).
    // The From: header in raw MIME has the friendly name we want.
    const fromHeaderMatch = raw.match(/^From:\s*(.+)$/im);
    const subjectMatch = raw.match(/^Subject:\s*(.+)$/im);
    const fromParsed = parseAddress(fromHeaderMatch?.[1] || message.from);

    const fromAddr = fromParsed.address || message.from;
    if (!fromAddr) {
      console.error("No sender address — skipping");
      return;
    }

    const payload = {
      from: fromAddr,
      from_name: fromParsed.name,
      to: message.to,
      subject: (subjectMatch?.[1] || "(no subject)").trim(),
      text: extractPlainTextBody(raw),
      html: extractHtmlBody(raw),
      received_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(env.INBOX_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-inbound-secret": env.INBOX_SECRET,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Webhook failed: ${res.status} ${errText}`);
      } else {
        console.log(`Email from ${fromAddr} forwarded to inbox`);
      }
    } catch (e) {
      console.error("Webhook request failed", e);
    }
  },
};
