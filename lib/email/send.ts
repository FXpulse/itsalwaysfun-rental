// Resend email helper — direct HTTP, no SDK needed.
// Set env vars:
//   RESEND_API_KEY        (required — get from resend.com dashboard)
//   EMAIL_FROM            (e.g. 'It''s Always Fun <bookings@itsalwaysfun.com>')
//   EMAIL_REPLY_TO        (e.g. 'admin@itsalwaysfun.com')
//
// Use isEmailConfigured() to check before calling send() so the app
// still works if Resend isn't set up yet (degrades gracefully).

export interface SendEmailParams {
  /** Per-send From override — pass the tenant-scoped From here. If omitted,
   *  falls back to `process.env.EMAIL_FROM` (single-tenant deploys). */
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: { name: string; value: string }[]; // Resend tags for analytics
}

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "Email not configured (missing RESEND_API_KEY or EMAIL_FROM)" };
  }

  const from = params.from || process.env.EMAIL_FROM!;
  const replyTo = params.replyTo || process.env.EMAIL_REPLY_TO;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
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
