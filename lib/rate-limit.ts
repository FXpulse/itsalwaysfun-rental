// Rate limiting using @upstash/ratelimit + Upstash Redis SDK.
//
// Setup (one-time, already done if you see KV_REST_API_URL in Vercel env):
//   1. Vercel Dashboard → Storage → Marketplace → Upstash → Connect
//   2. KV_REST_API_URL + KV_REST_API_TOKEN env vars auto-inject
//   3. Redeploy
//
// Fails OPEN (allows all requests) when env vars are missing — so local
// dev keeps working without provisioning Redis.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Lazy singletons — instantiate Redis client once per cold start.
let redis: Redis | null = null;
let initialized = false;

function getRedis(): Redis | null {
  if (initialized) return redis;
  initialized = true;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.warn("[rateLimit] KV env vars missing — failing open");
    return null;
  }
  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (e) {
    console.warn("[rateLimit] Redis init failed:", e);
    return null;
  }
}

// Cache Ratelimit instances per (max, windowSeconds) so we don't churn
// objects on every request.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(max: number, windowSeconds: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const cacheKey = `${max}:${windowSeconds}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
    analytics: false,
    prefix: "rl",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

/** Throttle a request by key (IP, email, token, etc.).
 *
 *  Usage:
 *    const r = await rateLimit(`login:${ip}`, { max: 5, windowSeconds: 60 });
 *    if (!r.allowed) return new Response("Too many requests", { status: 429 });
 *
 *  When Redis isn't configured (no KV env vars), returns { allowed: true }
 *  so the app keeps working — just without enforced limits. */
export async function rateLimit(
  key: string,
  opts: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const limiter = getLimiter(opts.max, opts.windowSeconds);
  if (!limiter) {
    return {
      allowed: true,
      remaining: opts.max,
      resetAt: Date.now() + opts.windowSeconds * 1000,
    };
  }
  try {
    const r = await limiter.limit(key);
    return {
      allowed: r.success,
      remaining: r.remaining,
      resetAt: r.reset,
    };
  } catch (e) {
    // Redis call failed — fail open
    console.error("[rateLimit] limit() failed, allowing:", e);
    return {
      allowed: true,
      remaining: opts.max,
      resetAt: Date.now() + opts.windowSeconds * 1000,
    };
  }
}

/** Extract the client IP from a Request. Vercel sets x-forwarded-for. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
