// lib/email/parser.ts
//
// Minimal RFC822 email parser. Built in-house to avoid mailparser's ESM/CJS
// interop bug on Node 22+ (mailparser → libmime → libqp → ...-sniffer.js
// fails with "require() of ES Module ... not supported").
//
// Covers the subset we need: headers, plain text body, and HTML body from
// multipart messages. Attachments are not extracted — we only flag their
// presence.
//
// sanitize is dynamically imported because isomorphic-dompurify has the same
// ESM/CJS issue on Node 22 + Vercel webpack.

export interface ParsedEmailMessage {
  message_id_header: string | null;
  in_reply_to: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;          // sanitized
  received_at: string | null;        // ISO
  has_attachments: boolean;
  raw_size_bytes: number;
}

export async function parseRawMessage(raw: Buffer): Promise<ParsedEmailMessage> {
  const rawStr = raw.toString("utf8");

  // 1. Split headers from body at first blank line (\r\n\r\n preferred, \n\n fallback)
  const headerEnd = findHeaderEnd(rawStr);
  const headerBlock = rawStr.slice(0, headerEnd);
  const body = rawStr.slice(headerEnd).replace(/^(\r\n|\n){1,2}/, "");

  // 2. Parse headers (unfolded — multi-line headers joined)
  const headers = parseHeaders(headerBlock);

  // 3. Extract addresses
  const from = parseAddressList(headers["from"] || "");
  const to = parseAddressList(headers["to"] || "");
  const cc = parseAddressList(headers["cc"] || "");

  // 4. Subject + Date
  const subject = decodeMimeHeader(headers["subject"] || null);
  const date = headers["date"] ? parseDate(headers["date"]) : null;

  // 5. Body — text + HTML extraction depending on Content-Type
  const contentType = headers["content-type"] || "text/plain";
  const { text, html, hasAttachments } = extractBodies(body, contentType, headers["content-transfer-encoding"]);

  // Lazy import sanitize (DOMPurify ESM/CJS issue on Node 22).
  let sanitizedHtml: string | null = null;
  if (html) {
    try {
      const { sanitizeEmailHtml } = await import("./sanitize");
      sanitizedHtml = sanitizeEmailHtml(html);
    } catch {
      // If sanitizer fails to load, drop the HTML rather than render unsafe markup.
      sanitizedHtml = null;
    }
  }

  return {
    message_id_header: (headers["message-id"] || "").trim() || null,
    in_reply_to: (headers["in-reply-to"] || "").trim() || null,
    from_address: from[0] || "(unknown)",
    to_addresses: to,
    cc_addresses: cc,
    subject,
    body_text: text,
    body_html: sanitizedHtml,
    received_at: date ? date.toISOString() : null,
    has_attachments: hasAttachments,
    raw_size_bytes: raw.length,
  };
}

function findHeaderEnd(s: string): number {
  const i1 = s.indexOf("\r\n\r\n");
  if (i1 >= 0) return i1;
  const i2 = s.indexOf("\n\n");
  if (i2 >= 0) return i2;
  return s.length;
}

function parseHeaders(headerBlock: string): Record<string, string> {
  // Unfold multi-line headers (lines starting with whitespace are continuations)
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const lines = unfolded.split(/\r?\n/).filter(Boolean);
  const out: Record<string, string> = {};
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    // Multiple headers with same name — concatenate
    out[name] = out[name] ? `${out[name]}, ${value}` : value;
  }
  return out;
}

function parseAddressList(headerValue: string): string[] {
  if (!headerValue) return [];
  const emails: string[] = [];
  // Match "Name <email@host>" or bare "email@host"
  const re = /(?:"[^"]*"\s+|\S+\s+)?<?([^\s<>,;]+@[^\s<>,;]+)>?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headerValue))) {
    const addr = m[1].toLowerCase().replace(/^[<"']+|[>"']+$/g, "");
    if (addr.includes("@")) emails.push(addr);
  }
  return emails;
}

function decodeMimeHeader(s: string | null): string | null {
  if (!s) return null;
  // Decode RFC 2047 encoded-word: =?charset?Q|B?...?=
  return s.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, _charset, enc, data) => {
    try {
      if (enc.toLowerCase() === "b") {
        return Buffer.from(data, "base64").toString("utf8");
      }
      // Q-encoding: =XX for hex, _ for space
      return data
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
    } catch {
      return data;
    }
  });
}

function parseDate(s: string): Date | null {
  try {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function decodeBody(body: string, encoding: string | undefined): string {
  if (!encoding) return body;
  const enc = encoding.toLowerCase().trim();
  if (enc === "base64") {
    try {
      return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      return body;
    }
  }
  if (enc === "quoted-printable") {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

function extractBodies(
  body: string,
  contentType: string,
  encoding?: string,
): { text: string | null; html: string | null; hasAttachments: boolean } {
  const lowerCt = contentType.toLowerCase();
  // Single part
  if (!lowerCt.includes("multipart/")) {
    const decoded = decodeBody(body, encoding);
    if (lowerCt.includes("text/html")) {
      return { text: null, html: decoded, hasAttachments: false };
    }
    return { text: decoded, html: null, hasAttachments: false };
  }

  // Multipart — find boundary
  const boundaryMatch = contentType.match(/boundary\s*=\s*"?([^";\r\n]+)"?/i);
  if (!boundaryMatch) {
    return { text: body, html: null, hasAttachments: false };
  }
  const boundary = boundaryMatch[1];
  const parts = body.split(`--${boundary}`).slice(1, -1); // drop preamble + epilogue

  let text: string | null = null;
  let html: string | null = null;
  let hasAttachments = false;

  for (const part of parts) {
    const partTrimmed = part.replace(/^(\r\n|\n)+/, "");
    const partHeaderEnd = findHeaderEnd(partTrimmed);
    const partHeaderBlock = partTrimmed.slice(0, partHeaderEnd);
    const partBody = partTrimmed.slice(partHeaderEnd).replace(/^(\r\n|\n){1,2}/, "");
    const partHeaders = parseHeaders(partHeaderBlock);
    const partCt = (partHeaders["content-type"] || "").toLowerCase();
    const partEnc = partHeaders["content-transfer-encoding"];
    const disposition = (partHeaders["content-disposition"] || "").toLowerCase();

    if (disposition.includes("attachment")) {
      hasAttachments = true;
      continue;
    }

    if (partCt.includes("multipart/")) {
      // Nested multipart — recurse
      const nested = extractBodies(partBody, partCt, partEnc);
      if (!text && nested.text) text = nested.text;
      if (!html && nested.html) html = nested.html;
      if (nested.hasAttachments) hasAttachments = true;
      continue;
    }

    if (partCt.includes("text/plain") && !text) {
      text = decodeBody(partBody, partEnc);
    } else if (partCt.includes("text/html") && !html) {
      html = decodeBody(partBody, partEnc);
    }
  }

  return { text, html, hasAttachments };
}
