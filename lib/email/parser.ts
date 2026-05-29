// lib/email/parser.ts
//
// Parse a raw RFC822 message buffer into the fields we store.
// Wraps `mailparser` with a tight interface.

import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { sanitizeEmailHtml } from "./sanitize";

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
  const parsed: ParsedMail = await simpleParser(raw);

  const toAddrs = addrList(parsed.to);
  const ccAddrs = addrList(parsed.cc);

  return {
    message_id_header: parsed.messageId || null,
    in_reply_to: parsed.inReplyTo || null,
    from_address: addrList(parsed.from)[0] || "(unknown)",
    to_addresses: toAddrs,
    cc_addresses: ccAddrs,
    subject: parsed.subject || null,
    body_text: parsed.text || null,
    body_html: parsed.html ? sanitizeEmailHtml(parsed.html) : null,
    received_at: parsed.date ? parsed.date.toISOString() : null,
    has_attachments: (parsed.attachments?.length ?? 0) > 0,
    raw_size_bytes: raw.length,
  };
}

function addrList(field: AddressObject | AddressObject[] | undefined): string[] {
  if (!field) return [];
  const list = Array.isArray(field) ? field : [field];
  const out: string[] = [];
  for (const obj of list) {
    for (const v of obj.value || []) {
      if (v.address) out.push(v.address.toLowerCase());
    }
  }
  return out;
}
