"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { requireStaffOrAdmin } from "@/lib/auth/roles";

const SUPPORTED_KEYS = new Set([
  "service_area",
  "geo_latitude",
  "geo_longitude",
  "price_range",
  "google_business_profile_url",
]);

export async function saveLocalSeo(input: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaffOrAdmin();
    const tenantId = getCurrentTenantId();
    const supabase = createAdminClient({ unscoped: true });

    // Light validation
    if (input.geo_latitude) {
      const lat = parseFloat(input.geo_latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return { ok: false, error: "Latitude must be between -90 and 90" };
      }
    }
    if (input.geo_longitude) {
      const lon = parseFloat(input.geo_longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        return { ok: false, error: "Longitude must be between -180 and 180" };
      }
    }
    if (input.price_range && !/^\${1,4}$/.test(input.price_range)) {
      return { ok: false, error: "Price range must be $, $$, $$$, or $$$$" };
    }
    if (input.google_business_profile_url && !/^https?:\/\//.test(input.google_business_profile_url)) {
      return { ok: false, error: "Google Business URL must start with https://" };
    }

    // Build upserts only for supported keys with non-empty values (or empty
    // strings to clear existing). Use upsert with conflict to be safe.
    const rows = Object.entries(input)
      .filter(([k]) => SUPPORTED_KEYS.has(k))
      .map(([key, value]) => ({
        tenant_id: tenantId,
        key,
        value: (value || "").trim(),
        category: key === "google_business_profile_url" ? "social" : "seo",
      }));

    if (rows.length === 0) return { ok: true };

    const { error } = await supabase
      .from("site_settings")
      .upsert(rows, { onConflict: "tenant_id,key" });
    if (error) {
      console.error("saveLocalSeo error:", error);
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/site");
    revalidatePath("/");
    return { ok: true };
  } catch (e: any) {
    console.error("saveLocalSeo threw:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}
