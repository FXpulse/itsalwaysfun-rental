"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { syncPlaceDataForTenant } from "@/lib/google-places/sync";
import { isPlacesConfigured } from "@/lib/google-places/client";

const SUPPORTED_KEYS = new Set([
  "service_area",
  "geo_latitude",
  "geo_longitude",
  "price_range",
  "google_business_profile_url",
  "google_places_manual_place_id",
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
    if (input.google_places_manual_place_id) {
      const trimmed = input.google_places_manual_place_id.trim();
      // Place IDs are alphanumeric + underscore + hyphen, length varies
      // (ChIJ ones are ~27 chars, others can differ). Be lenient on length;
      // just reject obvious garbage. Empty string is allowed (clears the override).
      if (trimmed && !/^[A-Za-z0-9_\-]{15,}$/.test(trimmed)) {
        return { ok: false, error: "Manual Place ID looks malformed — should be a string from Google's Place ID Finder (typically starts with ChIJ...)." };
      }
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

    // Auto-sync Google Places cache when either the GBP URL or the manual
    // Place ID was touched. Best-effort — don't fail the save if Places
    // lookup errors. Manual Place ID wins when both are present.
    let placesSyncResult: { ok: boolean; error?: string } | null = null;
    const touchedPlacesField =
      Object.keys(input).includes("google_business_profile_url") ||
      Object.keys(input).includes("google_places_manual_place_id");
    if (touchedPlacesField && isPlacesConfigured()) {
      try {
        placesSyncResult = await syncPlaceDataForTenant(
          tenantId,
          input.google_business_profile_url || "",
          input.google_places_manual_place_id?.trim() || undefined,
        );
      } catch (e: any) {
        console.error("[saveLocalSeo] places sync failed", e);
      }
    }

    revalidatePath("/admin/site");
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    return {
      ok: true,
      placesSyncError: placesSyncResult && !placesSyncResult.ok ? placesSyncResult.error : undefined,
    } as any;
  } catch (e: any) {
    console.error("saveLocalSeo threw:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Manual trigger to refresh place data (used in admin "Sync now" button). */
export async function refreshPlacesCache(): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaffOrAdmin();
    const tenantId = getCurrentTenantId();
    const supabase = createAdminClient({ unscoped: true });
    const { data: rows } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("tenant_id", tenantId)
      .in("key", ["google_business_profile_url", "google_places_manual_place_id"]);
    const settings = new Map((rows as any[] || []).map((r) => [r.key, r.value]));
    const url = (settings.get("google_business_profile_url") || "") as string;
    const manualPlaceId = (settings.get("google_places_manual_place_id") || "").trim() || undefined;
    if (!url && !manualPlaceId) {
      return { ok: false, error: "No Google Business URL or manual Place ID configured" };
    }
    const res = await syncPlaceDataForTenant(tenantId, url, manualPlaceId);
    revalidatePath("/admin/site");
    revalidatePath("/admin/reviews");
    return res;
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
