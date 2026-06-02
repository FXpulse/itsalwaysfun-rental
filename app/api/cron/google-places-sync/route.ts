// Daily cron — refresh Google Places cache for every tenant that has a
// GBP URL configured. Picks up new reviews + rating changes within 24hr.
//
// Vercel cron schedule (in vercel.json): "0 14 * * *"  (14:00 UTC daily,
// i.e. 9-10am Eastern depending on DST). One call per tenant; rate-limited
// internally by the 200ms delay between Places calls.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPlaceDataForTenant } from "@/lib/google-places/sync";
import { isPlacesConfigured } from "@/lib/google-places/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel cron auth — header set by Vercel when invoking
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isPlacesConfigured()) {
    return NextResponse.json({
      ran: false,
      reason: "GOOGLE_PLACES_API_KEY not configured",
    });
  }

  const supabase = createAdminClient({ unscoped: true });

  // Find every tenant with a configured GBP URL — these are the candidates
  const { data: settings } = await supabase
    .from("site_settings")
    .select("tenant_id, value")
    .eq("key", "google_business_profile_url")
    .not("value", "is", null);

  const tenants = ((settings as any[]) || []).filter((s) => s.value?.trim());

  const summary = {
    total: tenants.length,
    synced: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ tenant_id: string; error: string }>,
  };

  for (const s of tenants) {
    try {
      const result = await syncPlaceDataForTenant(s.tenant_id, s.value);
      if (result.ok) summary.synced++;
      else {
        summary.failed++;
        summary.errors.push({ tenant_id: s.tenant_id, error: result.error || "unknown" });
      }
    } catch (e: any) {
      summary.failed++;
      summary.errors.push({ tenant_id: s.tenant_id, error: e?.message || String(e) });
    }
    // Soft rate-limit between calls (Google Places quota friendliness)
    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json(summary);
}
