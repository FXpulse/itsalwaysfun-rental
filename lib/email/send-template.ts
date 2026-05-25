// Higher-level helper: load template by key from DB, substitute vars,
// fall back to hardcoded template if DB row is missing, send via Resend.

import { sendEmail, isEmailConfigured, type SendEmailParams } from "./send";
import { renderTemplate } from "./render-template";

export interface SendTemplatedParams {
  key: string;
  to: string | string[];
  vars: Record<string, any>;
  /** Used if the DB template is missing or fails to load. */
  fallback?: () => { subject: string; html: string; text: string };
  tags?: SendEmailParams["tags"];
  replyTo?: string;
  cc?: SendEmailParams["cc"];
  bcc?: SendEmailParams["bcc"];
}

export async function sendTemplated(
  params: SendTemplatedParams,
): Promise<{ ok: boolean; id?: string; error?: string; usedFallback?: boolean }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  let usedFallback = false;
  let rendered = await renderTemplate(params.key, params.vars);

  if (!rendered) {
    if (params.fallback) {
      rendered = params.fallback();
      usedFallback = true;
    } else {
      return {
        ok: false,
        error: `Template '${params.key}' not found in DB and no fallback provided`,
      };
    }
  }

  const r = await sendEmail({
    to: params.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: params.tags,
    replyTo: params.replyTo,
    cc: params.cc,
    bcc: params.bcc,
  });

  return { ...r, usedFallback };
}
