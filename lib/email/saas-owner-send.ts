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

import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { smtpSend } from "./smtp-client";
import { sendEmail, isEmailConfigured } from "./send";
import { getSaasOwnerEmailConfig } from "./saas-owner";
import type { EmailAccount } from "./types";

// Transport selection:
//   SAAS_OWNER_PREFER_SMTP=true  → try SMTP first, fall back to Resend on failure
//   SAAS_OWNER_PREFER_SMTP unset → use Resend only (default; matches what was
//                                  working before the SMTP refactor)
//
// To use the SMTP path:
//   1. /superadmin/email/accounts already has the info@ account row
//      (verified for stackmail.com — IMAP sync working)
//   2. Set SAAS_OWNER_PREFER_SMTP=true in Vercel production env
//   3. Redeploy
//   4. Check /superadmin/diagnostics or Sentry for SMTP errors after first
//      cron run. If clean for a week, you can leave it on permanently.
const PREFER_SMTP = process.env.SAAS_OWNER_PREFER_SMTP === "true";

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
 *
 *  Transport order depends on SAAS_OWNER_PREFER_SMTP:
 *    - true  → SMTP from the configured email_accounts row first; if it
 *              throws, fall back to Resend so the message still goes out
 *    - false → Resend only (default). Set SAAS_OWNER_PREFER_SMTP=true once
 *              SMTP is verified to work for your provider.
 *
 *  Either way the recipient sees the same From + Reply-To. */
export async function sendFromSaasOwner(
  input: SaasOwnerSendInput,
): Promise<SaasOwnerSendResult> {
  const owner = getSaasOwnerEmailConfig();
  const text = input.text || stripHtml(input.html);

  // Try SMTP first only if explicitly enabled
  if (PREFER_SMTP) {
    const account = await getSaasOwnerAccount();
    if (account) {
      try {
        const r = await smtpSend(account, {
          // Use the account's own label + email so the From: header matches
          // exactly what the provider expects to send (some SMTP servers
          // reject mismatched From under strict policy).
          from: `${account.label || "RentalFlow"} <${account.email_address}>`,
          to: [input.to],
          subject: input.subject,
          text,
          html: input.html,
        });
        return { ok: true, via: "smtp", messageId: r.messageId };
      } catch (e: any) {
        // SMTP failed — capture for visibility so we can fix the path,
        // then fall through to Resend so the email still goes out.
        Sentry.captureException(e, {
          tags: { area: "saas-owner-smtp" },
          extra: {
            host: account.smtp_host,
            port: account.smtp_port,
            tls: account.smtp_tls,
            email: account.email_address,
            errorMessage: e?.message,
          },
        });
        console.error(
          "[saas-owner SMTP failed, falling back to Resend]",
          e?.message,
        );
      }
    }
  }

  // Default path — Resend on the PLATFORM account.
  // Falls back to the tenant Resend account if RESEND_API_KEY_PLATFORM is
  // unset (so single-account deploys still work).
  if (isEmailConfigured()) {
    const platformKey =
      process.env.RESEND_API_KEY_PLATFORM || process.env.RESEND_API_KEY;
    const r = await sendEmail({
      apiKey: platformKey,
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
