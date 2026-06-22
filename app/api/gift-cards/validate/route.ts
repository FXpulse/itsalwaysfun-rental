// POST /api/gift-cards/validate
// Body: { code, subtotal_cents }
// Returns: { valid, balance_cents, applicable_cents, code } or { valid: false, reason }
//
// All failure responses use the same generic reason "Invalid or expired code"
// to prevent an attacker from enumerating which codes exist vs. which exist
// but have zero balance / are inactive / expired. The validate endpoint is
// public (called from the booking wizard), so the only viable mitigation
// against code-guessing is rate limiting + indistinguishable error messages.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  code: z.string().min(1).max(50),
  subtotal_cents: z.number().int().min(0),
});

const GENERIC_INVALID = "Invalid or expired code";

export async function POST(request: Request) {
  // 15 attempts/min/IP — generous for legit shoppers, restrictive enough
  // to make brute-force enumeration of the 32^8 code space hopeless.
  const ip = clientIp(request);
  const rl = await rateLimit(`giftcard-validate:${ip}`, {
    max: 15,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, reason: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, reason: "Invalid request" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, reason: "Invalid input" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const supabase = createAdminClient();
  const { data: card } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  // All failure modes return the same generic reason. The previous version
  // distinguished "Invalid code" vs "Card has no balance left" vs "Card is
  // disabled" vs "Card has expired" — each of those leaked existence of a
  // matching code, enabling enumeration.
  if (!card) return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  if (!card.is_active) return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  if (card.balance_cents <= 0)
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  if (card.expires_at && new Date(card.expires_at) < new Date())
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });

  // Apply up to subtotal or balance, whichever is smaller
  const applicable = Math.min(card.balance_cents, parsed.data.subtotal_cents);

  return NextResponse.json({
    valid: true,
    code: card.code,
    balance_cents: card.balance_cents,
    applicable_cents: applicable,
  });
}
