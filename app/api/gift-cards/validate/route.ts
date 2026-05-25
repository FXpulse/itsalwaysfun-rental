// POST /api/gift-cards/validate
// Body: { code, subtotal_cents }
// Returns: { valid, balance_cents, applicable_cents, code } or { valid: false, reason }

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const code = parsed.data.code.trim().toUpperCase();
  const supabase = createAdminClient();
  const { data: card } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (!card) return NextResponse.json({ valid: false, reason: "Invalid code" });
  if (!card.is_active) return NextResponse.json({ valid: false, reason: "Card is disabled" });
  if (card.balance_cents <= 0)
    return NextResponse.json({ valid: false, reason: "Card has no balance left" });
  if (card.expires_at && new Date(card.expires_at) < new Date())
    return NextResponse.json({ valid: false, reason: "Card has expired" });

  // Apply up to subtotal or balance, whichever is smaller
  const applicable = Math.min(card.balance_cents, parsed.data.subtotal_cents);

  return NextResponse.json({
    valid: true,
    code: card.code,
    balance_cents: card.balance_cents,
    applicable_cents: applicable,
  });
}
