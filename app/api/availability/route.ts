// GET /api/availability?product_id=<uuid>&date=YYYY-MM-DD
// Returns { available: boolean, reason: string | null }
//
// Per-IP rate limit: this is the cheapest endpoint to scrape (one row out)
// and the booking wizard fires it on each (product_id, date) check. 60/min
// is generous for legit use, restrictive enough to block automated probing.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  product_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limit = await rateLimit(`public-availability:${ip}`, {
    max: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const parse = QuerySchema.safeParse({
    product_id: searchParams.get("product_id") || "",
    date: searchParams.get("date") || "",
  });

  if (!parse.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parse.error.flatten() },
      { status: 400 }
    );
  }

  const { product_id, date } = parse.data;
  const supabase = createAdminClient();

  // 1. Product exists + active + stock
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, stock, is_active")
    .eq("id", product_id)
    .single();

  if (prodErr || !product) {
    return NextResponse.json(
      { available: false, reason: "Product not found" },
      { status: 404 }
    );
  }
  if (!product.is_active) {
    return NextResponse.json({
      available: false,
      reason: "Product temporarily unavailable",
    });
  }

  // 2. Blocked dates check
  const { data: blocked } = await supabase
    .from("blocked_dates")
    .select("reason")
    .eq("product_id", product_id)
    .eq("blocked_date", date)
    .limit(1)
    .maybeSingle();

  if (blocked) {
    return NextResponse.json({
      available: false,
      reason: blocked.reason ? `Blocked — ${blocked.reason}` : "Blocked",
    });
  }

  // 3. Existing bookings — only PAID bookings count.
  // Unpaid pending_payment bookings don't block inventory.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, booking_status")
    .eq("product_id", product_id)
    .eq("event_date", date)
    .in("booking_status", ["confirmed", "delivered"]);

  const activeBookings = bookings || [];

  if (activeBookings.length >= product.stock) {
    return NextResponse.json({
      available: false,
      reason: "Already booked",
    });
  }

  return NextResponse.json({ available: true, reason: null });
}
