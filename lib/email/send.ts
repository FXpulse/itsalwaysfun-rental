// Resend email helper — direct HTTP, no SDK needed.
// Set env vars:
//   RESEND_API_KEY            (required — tenant emails, "It's Always Fun" account)
//   RESEND_API_KEY_PLATFORM   (optional — platform emails, "getrentalflow"
//                              account. Falls back to RESEND_API_KEY if unset.)
//   EMAIL_FROM                (e.g. 'RentalFlow <info@getrentalflow.com>')
//   EMAIL_REPLY_TO            (e.g. 'info@getrentalflow.com')
//
// TWO RESEND ACCOUNTS (architecture decision 2026-06-17):
//   1. Tenant account — owns itsalwaysfun.com (+ future tenant domains).
//      Used for tenant → customer emails (booking confirmation, reminders).
//      API key in RESEND_API_KEY.
//   2. Platform account — owns getrentalflow.com.
//      Used for platform → operator emails (beta lifecycle, dunning, etc.).
//      API key in RESEND_API_KEY_PLATFORM.
//
// Separation = independent billing, quota, domain verification, reputation.
//
// For per-tenant From / Reply-To (customer-facing transactional emails),
// use getTenantEmailConfig(tenantId). For platform → operator emails
// (lifecycle, dunning, backups), use sendFromSaasOwner() which passes
// the platform apiKey automatically.

export interface SendEmailParams {
  /** Per-send From override. If omitted, falls back to `process.env.EMAIL_FROM`. */
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[]; // Resend tags for analytics
  /** Override which Resend API key to use. If omitted, uses the tenant
   *  account key (RESEND_API_KEY). Pass the platform account key for
   *  platform-side emails — see sendFromSaasOwner(). */
  apiKey?: string;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** True iff the platform Resend account is configured (separate from the
 *  tenant account). Falls back to tenant key, so this returns true as long
 *  as ANY key is available — caller decides which path to log. */
export function isPlatformEmailConfigured(): boolean {
  return !!(
    (process.env.RESEND_API_KEY_PLATFORM || process.env.RESEND_API_KEY) &&
    process.env.EMAIL_FROM
  );
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = params.apiKey || process.env.RESEND_API_KEY;
  if (!apiKey || !process.env.EMAIL_FROM) {
    return { ok: false, error: "Email not configured (missing RESEND_API_KEY or EMAIL_FROM)" };
  }

  const from = params.from || process.env.EMAIL_FROM!;
  const replyTo = params.replyTo || process.env.EMAIL_REPLY_TO;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: replyTo,
        cc: params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined,
        bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined,
        tags: params.tags,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Resend send failed]", res.status, errText);
      return { ok: false, error: `${res.status}: ${errText.substring(0, 200)}` };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e: any) {
    console.error("[Resend send exception]", e);
    return { ok: false, error: e.message || "Unknown error" };
  }
}
