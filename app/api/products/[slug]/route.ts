// GET /api/products/[slug]
// Single product details + unavailable dates for the next 90 days.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const parseResult = SlugSchema.safeParse(params.slug);
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1. Fetch product
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("*")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 2. Compute next-90-days unavailable dates
  const today = new Date();
  const inNinetyDays = new Date();
  inNinetyDays.setDate(today.getDate() + 90);
  const todayISO = today.toISOString().split("T")[0];
  const ninetyDaysISO = inNinetyDays.toISOString().split("T")[0];

  // Get all bookings that occupy this product in the next 90 days
  const { data: bookings } = await supabase
    .from("bookings")
    .select("event_date, booking_status, hold_expires_at")
    .eq("product_id", product.id)
    .gte("event_date", todayISO)
    .lte("event_date", ninetyDaysISO)
    .in("booking_status", ["pending_payment", "confirmed", "delivered"]);

  // Get manual blocked dates
  const { data: blocks } = await supabase
    .from("blocked_dates")
    .select("blocked_date, reason")
    .eq("product_id", product.id)
    .gte("blocked_date", todayISO)
    .lte("blocked_date", ninetyDaysISO);

  // Filter out expired holds (pending_payment with hold_expires_at < now)
  const now = new Date();
  const unavailableDates = new Set<string>();

  for (const b of bookings || []) {
    if (
      b.booking_status === "pending_payment" &&
      b.hold_expires_at &&
      new Date(b.hold_expires_at) < now
    ) {
      continue; // expired hold, ignore
    }
    unavailableDates.add(b.event_date);
  }
  for (const bd of blocks || []) {
    unavailableDates.add(bd.blocked_date);
  }

  return NextResponse.json({
    product,
    unavailable_dates: Array.from(unavailableDates).sort(),
    range: { from: todayISO, to: ninetyDaysISO },
  });
}
