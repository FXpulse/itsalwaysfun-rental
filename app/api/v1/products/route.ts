// GET /api/v1/products — list catalog products for the authenticated tenant.

import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/authenticate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req, "products:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
  const activeOnly = searchParams.get("active") !== "false";

  const supabase = createAdminClient({ unscoped: true });
  let query = supabase
    .from("products")
    .select("id, slug, name, category, description, price_per_day_cents, weekend_price_per_day_cents, stock, image_url, is_active, is_addon, setup_area, age_group, created_at")
    .eq("tenant_id", auth.tenant_id)
    .order("name");
  if (activeOnly) query = query.eq("is_active", true);
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ products: data || [], count: data?.length || 0 });
}
