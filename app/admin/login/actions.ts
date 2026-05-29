"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

// Two-layer rate limit on login attempts:
//   * Per-IP — blocks distributed brute force against many emails
//   * Per-email — blocks credential stuffing against one account
//
// Both fail open if Upstash isn't configured, matching the rest of the app.

export async function loginAction(
  email: string,
  password: string,
): Promise<{ success: true } | { error: string }> {
  const e = email.trim().toLowerCase();
  if (!e || !password) return { error: "Email and password are required" };

  const h = headers();
  const ip =
    (h.get("x-forwarded-for")?.split(",")[0]?.trim()) ||
    h.get("x-real-ip") ||
    "unknown";

  // 5 attempts per 15 min per IP
  const ipLimit = await rateLimit(`login:ip:${ip}`, {
    max: 5,
    windowSeconds: 15 * 60,
  });
  if (!ipLimit.allowed) {
    return {
      error: "Too many sign-in attempts. Wait 15 minutes and try again.",
    };
  }

  // 10 attempts per hour per email — prevents one IP rotating identities,
  // and blocks a botnet from hammering the same email from many IPs.
  const emailLimit = await rateLimit(`login:email:${e}`, {
    max: 10,
    windowSeconds: 60 * 60,
  });
  if (!emailLimit.allowed) {
    return {
      error: "Too many sign-in attempts for this account. Try again in 1 hour.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: e,
    password,
  });

  if (error) {
    // Don't leak whether the email exists — generic message
    return { error: "Invalid email or password" };
  }

  return { success: true };
}
