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

const PATTERNS: Array<{ name: string; re: RegExp; replace: string }> = [
  // Email — handles +tags and unicode TLDs
  {
    name: "email",
    re: /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
    replace: "[email-redacted]",
  },
  // North American phone numbers — (904) 584-3047, +1-904-584-3047, 904.584.3047
  {
    name: "phone",
    re: /(?<!\d)\+?1?[\s.()-]?\(?\d{3}\)?[\s.()-]?\d{3}[\s.()-]?\d{4}(?!\d)/g,
    replace: "[phone-redacted]",
  },
  // Credit-card-like 13-19 digit numbers (with spaces/dashes allowed)
  {
    name: "card",
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    replace: "[card-redacted]",
  },
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
  // Supabase service role tokens (sbp_...) or anon-looking keys
  {
    name: "supabase-token",
    re: /\bsbp_[A-Za-z0-9]{20,}/g,
    replace: "[supabase-token-redacted]",
  },
  // Bearer header values
  {
    name: "bearer",
    re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replace: "Bearer [redacted]",
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
