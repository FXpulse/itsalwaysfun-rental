// GET /api/v1/customers — list customer profiles for the authenticated tenant.

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "customers:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

  const supabase = createAdminClient({ unscoped: true });
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("id, email, first_name, last_name, phone, total_bookings, total_spent_cents, points_balance, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customers: data || [], count: data?.length || 0 });
}
