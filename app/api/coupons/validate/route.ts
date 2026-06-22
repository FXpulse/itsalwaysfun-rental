// POST /api/coupons/validate
// Body: { code: string, subtotal_cents: number }
// Returns: { valid: true, coupon, discount, new_total } or { valid: false, reason }
//
// Public endpoint hit by the booking wizard. Two protections vs. enumeration:
//   1. Per-IP rate limit (15/min)
//   2. Generic failure message — does not distinguish "code does not exist"
//      from "code expired" or "usage limit reached", so the response leaks
//      nothing about which codes are valid.

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyCoupon } from "@/lib/pricing";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getCurrentTenantId } from "@/lib/tenant/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  code: z.string().min(1).max(50),
  subtotal_cents: z.number().int().min(0),
});

const GENERIC_INVALID = "Invalid or expired code";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = await rateLimit(`coupon-validate:${ip}`, {
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

  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  }

  const supabase = createAdminClient();
  const code = parsed.data.code.trim().toUpperCase();

  // Explicit tenant filter — defense in depth so a coupon on tenant A
  // cannot be applied on a checkout for tenant B even if the scope proxy
  // were ever misconfigured.
  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .ilike("code", code)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!coupon) {
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  }
  if (!coupon.is_active) {
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  }
  if (coupon.max_uses != null && coupon.current_uses >= coupon.max_uses) {
    return NextResponse.json({ valid: false, reason: GENERIC_INVALID });
  }

  const { total, discount } = applyCoupon(parsed.data.subtotal_cents, {
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
  });

  return NextResponse.json({
    valid: true,
    coupon: {
      code: coupon.code,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
    },
    discount,
    new_total: total,
  });
}
