// Platform → operator email send path.
//
// IMPORTANT — TWO SEPARATE EMAIL SYSTEMS IN THIS CODEBASE:
//
//   1. TENANT → CUSTOMER (booking confirmations, reminders, gift cards):
//      Resend via lib/email/send.ts + getTenantEmailConfig(tenantId).
//      Per-tenant From + Reply-To. Customer sees the tenant's brand.
//
//   2. PLATFORM → OPERATOR (beta lifecycle, dunning, onboarding nudges,
//      weekly-backup link, beta feedback notifications, anything from
//      Ludmila to a tenant owner):
//      THIS MODULE. Direct SMTP from the info@getrentalflow.com mailbox
//      (configured in /superadmin/email/accounts as an email_accounts row).
//      DKIM/SPF for getrentalflow.com matches the SMTP provider, replies
//      land in the same mailbox the email came from, Ludmila has a
//      complete record of platform correspondence in her IMAP client.
//
// Falls back to Resend if the SMTP account isn't configured (so a fresh
// deploy still sends, just without the cohesive inbox experience).
//
// To configure: superadmin → /superadmin/email/accounts → add an account
// with email_address = info@getrentalflow.com. The SAAS_OWNER_EMAIL env
// var (default "info@getrentalflow.com") controls which account this
// module looks up.

import { createAdminClient } from "@/lib/supabase/admin";
import { smtpSend } from "./smtp-client";
import { sendEmail, isEmailConfigured } from "./send";
import { getSaasOwnerEmailConfig } from "./saas-owner";
import type { EmailAccount } from "./types";

let cached: EmailAccount | null | undefined = undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/** Look up the email_accounts row for the SaaS owner inbox.
 *  Cached for 60s per-process to avoid hitting the DB on every send. */
async function getSaasOwnerAccount(): Promise<EmailAccount | null> {
  const now = Date.now();
  if (cached !== undefined && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }
  const addr = process.env.SAAS_OWNER_EMAIL || "info@getrentalflow.com";
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("email_accounts")
    .select(
      "id, brand, label, email_address, imap_host, imap_port, imap_tls, smtp_host, smtp_port, smtp_tls, username, encrypted_password, last_sync_at, last_synced_uid_per_folder, last_sync_error, last_sync_error_at, consecutive_failures, is_active, created_at, updated_at",
    )
    .eq("email_address", addr)
    .eq("is_active", true)
    .maybeSingle();
  cached = (data as EmailAccount | null) || null;
  cachedAt = now;
  return cached;
}

export interface SaasOwnerSendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SaasOwnerSendResult {
  ok: boolean;
  via: "smtp" | "resend" | "none";
  error?: string;
  messageId?: string;
}

/** Send an email FROM the SaaS owner inbox (info@getrentalflow.com).
 *  Prefers the configured email_accounts SMTP row; falls back to Resend
 *  with the same From + Reply-To so the recipient always sees the same
 *  address regardless of transport. */
export async function sendFromSaasOwner(
  input: SaasOwnerSendInput,
): Promise<SaasOwnerSendResult> {
  const owner = getSaasOwnerEmailConfig();
  const text = input.text || stripHtml(input.html);

  // Prefer SMTP from the configured account
  const account = await getSaasOwnerAccount();
  if (account) {
    try {
      const r = await smtpSend(account, {
        from: owner.from,
        to: [input.to],
        subject: input.subject,
        text,
        html: input.html,
      });
      return { ok: true, via: "smtp", messageId: r.messageId };
    } catch (e: any) {
      // SMTP failed — fall through to Resend so the message still goes out.
      console.error(
        "[saas-owner SMTP failed, falling back to Resend]",
        e?.message,
      );
    }
  }

  // Fallback to Resend
  if (isEmailConfigured()) {
    const r = await sendEmail({
      to: input.to,
      from: owner.from,
      replyTo: owner.replyTo,
      subject: input.subject,
      html: input.html,
      text,
      tags: input.tags,
    });
    return {
      ok: !!r.ok,
      via: "resend",
      error: r.ok ? undefined : (r as any).error,
      messageId: r.ok ? (r as any).id : undefined,
    };
  }

  return { ok: false, via: "none", error: "no_email_path_configured" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
