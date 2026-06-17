// PII scrubbing for Sentry events.
//
// Sentry's sendDefaultPii=false strips obvious user fields (req.user.email),
// but PII routinely leaks via:
//   - Error messages that include the offending value ("invalid email foo@bar.com")
//   - Breadcrumbs from console.log / fetch URLs (?email=...)
//   - Stack frame source lines that captured the variable
//   - Tags / extra that we set deliberately
//
// This walker scrubs all of those before the event leaves the process. Each
// regex below errs on the side of redaction — false positives just turn a
// real value into `[email-redacted]` which is fine for an error report.

// ORDER MATTERS. Token patterns must run BEFORE phone/card so the phone
// regex doesn't eat 10-digit runs inside an API key (e.g. whsec_1234567890...).
// Each pattern's `replace` is itself token-safe so a later pattern can't
// re-match a previous redaction.
const PATTERNS: Array<{ name: string; re: RegExp; replace: string }> = [
  // ── Tokens / API keys first ────────────────────────────────────────
  // JWT tokens — eyJ... three base64 segments
  {
    name: "jwt",
    re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replace: "[jwt-redacted]",
  },
  // Stripe live secret + restricted keys (test keys we leave — they're public)
  {
    name: "stripe-key",
    re: /\b(?:sk_live|rk_live|whsec)_[A-Za-z0-9]{20,}/g,
    replace: "[stripe-key-redacted]",
  },
  // Supabase service role tokens (sbp_...)
  {
    name: "supabase-token",
    re: /\bsbp_[A-Za-z0-9]{20,}/g,
    replace: "[supabase-token-redacted]",
  },
  // RentalFlow programmatic API keys (rfk_*) — tenant-generated /api/v1 tokens
  {
    name: "rfk-key",
    re: /\brfk_[A-Za-z0-9]{20,}/g,
    replace: "[rfk-key-redacted]",
  },
  // GoHighLevel personal integration tokens (pit-*) — long-lived bearer
  {
    name: "ghl-pit",
    re: /\bpit-[a-f0-9-]{20,}/g,
    replace: "[ghl-pit-redacted]",
  },
  // Resend API keys (re_*)
  {
    name: "resend-key",
    re: /\bre_[A-Za-z0-9_]{20,}/g,
    replace: "[resend-key-redacted]",
  },
  // Anthropic API keys (sk-ant-*) — specific to avoid false-positive with OpenAI sk-*
  {
    name: "anthropic-key",
    re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
    replace: "[anthropic-key-redacted]",
  },
  // OpenAI API keys (sk-proj-*, sk-*) — broad sk- match without prefix would
  // hit too many false positives, so we only match the documented prefixes
  {
    name: "openai-key",
    re: /\bsk-proj-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{40,}/g,
    replace: "[openai-key-redacted]",
  },
  // Twilio AuthToken (32 hex chars) when prefixed by AC<sid> context
  {
    name: "twilio-auth",
    re: /AC[a-f0-9]{32}[:|\s]+[a-f0-9]{32}/g,
    replace: "[twilio-auth-redacted]",
  },
  // Bearer header values
  {
    name: "bearer",
    re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replace: "Bearer [redacted]",
  },
  // ── PII content next (after token patterns) ───────────────────────
  // Email — handles +tags and unicode TLDs
  {
    name: "email",
    re: /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
    replace: "[email-redacted]",
  },
  // North American phone numbers — (904) 584-3047, +1-904-584-3047, 904.584.3047
  // The leading `\+?1?` allows an optional country code attached to the number
  // (no leading separator) without eating the preceding whitespace.
  {
    name: "phone-na",
    re: /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.()-]?\d{3}[\s.()-]?\d{4}(?!\d)/g,
    replace: "[phone-redacted]",
  },
  // E.164 international phone — +<country code 1-3 digits><up to 12 digits>
  // Already covered for +1 by phone-na, this catches non-NA (+44, +52, +54, etc.)
  {
    name: "phone-e164",
    re: /(?<!\d)\+(?:[2-9]\d{0,2})\d{6,13}(?!\d)/g,
    replace: "[phone-redacted]",
  },
  // Credit-card-like 13-19 digit numbers (with spaces/dashes allowed)
  {
    name: "card",
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    replace: "[card-redacted]",
  },
];

// Header names whose VALUES should always be replaced (case-insensitive).
const REDACT_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-auth-token",
  "x-supabase-auth",
  "x-csrf-token",
  "stripe-signature",
  "x-vercel-id",
]);

// Query param names whose values should always be replaced.
const REDACT_QUERY_PARAMS = new Set([
  "email",
  "phone",
  "token",
  "key",
  "apikey",
  "api_key",
  "secret",
  "password",
  "access_token",
  "refresh_token",
  "code",
]);

// Object KEYS whose VALUES we redact verbatim — for free-form PII that
// regexes won't catch (customer first names, free-text addresses, etc.).
// Match is case-insensitive on the raw key name.
const REDACT_KEYS = new Set([
  // Customer-direct identifiers
  "customer_email",
  "customer_phone",
  "customer_first_name",
  "customer_last_name",
  "customer_address",
  "customer_name",
  "first_name",
  "last_name",
  // Waiver e-signature: the signer's typed name
  "signed_name",
  "signer_name",
  // Address fields
  "billing_address",
  "shipping_address",
  "address1",
  "address2",
  "address_line1",
  "address_line2",
  // Phone variations
  "phone",
  "phone_number",
  // Email fallback (in addition to the regex)
  "email",
  // Auth secrets
  "password",
  "encrypted_password",
  "auth_token",
  "service_role_key",
  "api_key",
  "client_secret",
  // Stripe-side fields that can carry PII or customer-linking
  "payment_method",
]);

/** Scrub a single string by running all regex passes. */
function scrubString(s: string): string {
  let out = s;
  for (const p of PATTERNS) out = out.replace(p.re, p.replace);
  return out;
}

/** Redact sensitive query params in a URL string without breaking it. */
function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "http://x");
    let changed = false;
    for (const key of Array.from(u.searchParams.keys())) {
      if (REDACT_QUERY_PARAMS.has(key.toLowerCase())) {
        u.searchParams.set(key, "[redacted]");
        changed = true;
      }
    }
    if (!changed) return scrubString(url);
    // If the input was a relative URL we still get a hostname=x — strip it back.
    if (!url.match(/^https?:\/\//i)) {
      return `${u.pathname}${u.search}`;
    }
    return u.toString();
  } catch {
    return scrubString(url);
  }
}

/** Recursive walker — mutates the value in place where safe. Caps depth so
 *  we don't blow the stack on circular event payloads. */
function walk(value: any, depth: number): any {
  if (depth > 6 || value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const klow = k.toLowerCase();
      // Headers map — redact whole values for sensitive header names
      if (klow === "headers" && v && typeof v === "object") {
        out[k] = scrubHeaders(v as Record<string, any>);
        continue;
      }
      // Cookies map — drop content entirely
      if (klow === "cookies" && v && typeof v === "object") {
        out[k] = "[cookies-redacted]";
        continue;
      }
      // URL fields — preserve structure, redact query params
      if ((klow === "url" || klow === "request_url") && typeof v === "string") {
        out[k] = scrubUrl(v);
        continue;
      }
      // Known PII field names — redact the value verbatim regardless of type
      if (REDACT_KEYS.has(klow)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = walk(v, depth + 1);
    }
    return out;
  }
  return value;
}

function scrubHeaders(headers: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (REDACT_HEADERS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
    } else if (typeof v === "string") {
      out[k] = scrubString(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Sentry beforeSend hook — call this from sentry.{client,server,edge}.config.ts. */
export function scrubSentryEvent(event: any): any {
  if (!event) return event;
  try {
    return walk(event, 0);
  } catch {
    // If scrubbing itself throws, drop the event rather than risk leaking PII
    return null;
  }
}
