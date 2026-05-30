// GET /api/v1/availability?product_id=...&start=2026-06-01&end=2026-06-30
// Returns which dates are available vs. taken for a product, so 3rd parties
// can show availability inside Zapier/Make/their own checkout flow.

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "bookings:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("product_id");
  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");

  if (!startRaw || !endRaw) {
    return NextResponse.json(
      { error: "missing_params", required: ["start", "end"] },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(endRaw)) {
    return NextResponse.json({ error: "invalid_date_format", expected: "YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = createAdminClient({ unscoped: true });

  // Resolve product + stock
  let stock = 1;
  if (productId) {
    const { data: p } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", productId)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (!p) return NextResponse.json({ error: "product_not_found_for_tenant" }, { status: 404 });
    stock = p.stock ?? 1;
  }

  // Pull non-cancelled bookings in the window
  let q = supabase
    .from("bookings")
    .select("event_date, event_end_date, product_id")
    .eq("tenant_id", auth.tenant_id)
    .neq("booking_status", "cancelled")
    .gte("event_date", startRaw)
    .lte("event_date", endRaw);
  if (productId) q = q.eq("product_id", productId);
  const { data: bookings } = await q;

  // Count bookings per date
  const counts = new Map<string, number>();
  for (const b of (bookings as any[]) || []) {
    counts.set(b.event_date, (counts.get(b.event_date) || 0) + 1);
  }

  // Build day-by-day result
  const days: Array<{ date: string; booked: number; available: number; sold_out: boolean }> = [];
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const booked = counts.get(iso) || 0;
    const available = Math.max(0, stock - booked);
    days.push({ date: iso, booked, available, sold_out: available === 0 });
  }

  return NextResponse.json({
    product_id: productId,
    stock,
    range: { start: startRaw, end: endRaw },
    days,
  });
}
