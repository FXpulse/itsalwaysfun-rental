// GET /api/products
// Returns all active products. Public endpoint (used by itsalwaysfun.com + customer-facing flows).
//
// Per-IP rate limit: protects Supabase from catalog scrape attacks.
// Generous (60/min) so a legit page that fans out doesn't hit it.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`public-products:${ip}`, {
    max: 60,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, category, price_per_day, image_url, setup_area, age_group, stock"
    )
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch products", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { products: data || [] },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
