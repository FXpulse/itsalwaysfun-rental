// Twilio SMS sender — HTTP-based, no SDK dep needed.
// Env vars:
//   TWILIO_ACCOUNT_SID    (starts with AC...)
//   TWILIO_AUTH_TOKEN     (Twilio dashboard)
//   TWILIO_FROM_NUMBER    (in E.164: +19045551234)
//
// If any are missing, isSmsConfigured() returns false and sends are skipped
// silently — same gracefully-degrades pattern as Resend.

export interface SendSmsParams {
  to: string;       // E.164 or US-formatted; we normalize
  body: string;     // <= 1600 chars (auto-split by Twilio if longer)
}

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

/** Normalize a US phone to E.164 (+1XXXXXXXXXX). Returns null if invalid. */
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

export async function sendSms(
  params: SendSmsParams,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!isSmsConfigured()) {
    return { ok: false, error: "SMS not configured (missing Twilio env vars)" };
  }

  const to = normalizePhone(params.to);
  if (!to) {
    return { ok: false, error: `Invalid phone format: ${params.to}` };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: params.body.substring(0, 1600),
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Twilio SMS failed]", res.status, errText);
      return { ok: false, error: `${res.status}: ${errText.substring(0, 200)}` };
    }

    const data = await res.json();
    return { ok: true, sid: data.sid };
  } catch (e: any) {
    console.error("[Twilio SMS exception]", e);
    return { ok: false, error: e.message || "Unknown error" };
  }
}
