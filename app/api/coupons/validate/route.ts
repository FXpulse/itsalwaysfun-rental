// POST /api/coupons/validate
// Body: { code: string, subtotal_cents: number }
// Returns: { valid: true, coupon, discount, new_total } or { valid: false, reason }

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyCoupon } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  code: z.string().min(1).max(50),
  subtotal_cents: z.number().int().min(0),
});

export async function POST(request: Request) {
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

  const supabase = createAdminClient();
  const code = parsed.data.code.trim().toUpperCase();

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .ilike("code", code)
    .single();

  if (!coupon) {
    return NextResponse.json({ valid: false, reason: "Invalid code" });
  }
  if (!coupon.is_active) {
    return NextResponse.json({ valid: false, reason: "Coupon no longer active" });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: "Coupon expired" });
  }
  if (coupon.max_uses != null && coupon.current_uses >= coupon.max_uses) {
    return NextResponse.json({ valid: false, reason: "Coupon usage limit reached" });
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
