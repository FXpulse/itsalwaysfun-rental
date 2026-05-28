// Lightweight rate limiting using Vercel KV (Redis). Falls back to a
// no-op (allow all) if KV env vars aren't set — so the app still works
// in local dev without provisioning KV.
//
// Setup (one-time):
//   1. Vercel Dashboard → Storage → Create Database → KV
//   2. Connect to the itsalwaysfun-rental project
//   3. The env vars KV_REST_API_URL + KV_REST_API_TOKEN auto-inject
//   4. Redeploy (Vercel does this automatically when you connect)
//
// After that, calling rateLimit() actually enforces the limit. No code
// changes needed — just connect the KV store.

interface RateLimitResult {
  /** True when the request is within the limit and should proceed. */
  allowed: boolean;
  /** How many requests remain in the current window (0 if blocked). */
  remaining: number;
  /** UNIX ms when the current window resets. */
  resetAt: number;
}

let kvAvailable: "yes" | "no" | "unknown" = "unknown";

async function kvIncrement(
  key: string,
  windowSeconds: number,
): Promise<{ count: number; ttl: number }> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV not configured");
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // Pipeline: INCR + EXPIRE in one call
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSeconds), "NX"],
      ["TTL", key],
    ]),
  });
  if (!res.ok) throw new Error(`KV pipeline ${res.status}`);
  const arr = (await res.json()) as Array<{ result: number }>;
  const count = Number(arr?.[0]?.result) || 0;
  const ttl = Number(arr?.[2]?.result) || windowSeconds;
  return { count, ttl };
}

/** Rate-limit a request by some identifier (IP, email, token, etc.).
 *
 *  Usage:
 *    const r = await rateLimit(`login:${ip}`, { max: 5, windowSeconds: 60 });
 *    if (!r.allowed) return new Response("Too many requests", { status: 429 });
 */
export async function rateLimit(
  key: string,
  opts: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  // Cache whether KV is reachable so we don't probe on every request
  if (kvAvailable === "no") {
    return { allowed: true, remaining: opts.max, resetAt: Date.now() + opts.windowSeconds * 1000 };
  }

  try {
    const { count, ttl } = await kvIncrement(`rl:${key}`, opts.windowSeconds);
    kvAvailable = "yes";
    const remaining = Math.max(0, opts.max - count);
    const resetAt = Date.now() + Math.max(1, ttl) * 1000;
    return { allowed: count <= opts.max, remaining, resetAt };
  } catch (e) {
    // KV unavailable — fail OPEN (don't block real users) but log once so
    // we notice and provision it.
    const wasAvailable: string = kvAvailable;
    if (wasAvailable !== "no") {
      console.warn("[rateLimit] KV unavailable, allowing all:", e);
      kvAvailable = "no";
    }
    return { allowed: true, remaining: opts.max, resetAt: Date.now() + opts.windowSeconds * 1000 };
  }
}

/** Extract the client IP from a Request — Vercel sets x-forwarded-for. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
