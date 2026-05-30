// GET /api/v1/bookings — list bookings for the authenticated tenant.
// Auth: Authorization: Bearer rfk_...
// Scopes: bookings:read

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "bookings:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
  const since = searchParams.get("since");          // ISO date
  const status = searchParams.get("status");        // confirmed / pending / etc

  const supabase = createAdminClient({ unscoped: true });
  let query = supabase
    .from("bookings")
    .select("id, status, customer_first_name, customer_last_name, customer_email, customer_phone, event_date, delivery_time, pickup_time, total_cents, paid_cents, address, city, state, zip, notes, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (since) query = query.gte("created_at", since);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data || [], count: data?.length || 0 });
}
