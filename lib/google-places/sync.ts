// Sync helper: resolves a tenant's GBP URL to place details and persists
// to google_places_cache. Called from /admin/site after URL update and
// from a daily cron.

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBusinessFromUrl, isPlacesConfigured } from "./client";

export async function syncPlaceDataForTenant(
  tenantId: string,
  gbpUrl: string,
): Promise<{ ok: boolean; place_id?: string; error?: string }> {
  if (!isPlacesConfigured()) {
    return { ok: false, error: "GOOGLE_PLACES_API_KEY not configured" };
  }
  if (!gbpUrl) {
    // Tenant cleared the URL — wipe cache
    const supabase = createAdminClient({ unscoped: true });
    await supabase.from("google_places_cache").delete().eq("tenant_id", tenantId);
    return { ok: true };
  }

  const details = await resolveBusinessFromUrl(gbpUrl);
  if (!details || !details.id) {
    const supabase = createAdminClient({ unscoped: true });
    await supabase
      .from("google_places_cache")
      .upsert({
        tenant_id: tenantId,
        source_url: gbpUrl,
        last_synced_at: new Date().toISOString(),
        last_sync_status: "not_found",
        last_sync_error: "Could not resolve URL to a Google Place",
      }, { onConflict: "tenant_id" });
    return {
      ok: false,
      error:
        "Could not resolve URL. Most common causes: (1) 'Places API (New)' not enabled — go to Google Cloud Console → APIs & Services → Library → search 'Places API (New)' → click Enable. It's separate from the legacy Places API. (2) API key restrictions don't include Places API (New). Check Vercel function logs for '[Places API]' lines to see exactly which step failed.",
    };
  }

  // Normalize reviews to a compact shape
  const reviews = (details.reviews || []).map((r) => ({
    author: r.authorAttribution?.displayName || "Anonymous",
    photo_url: r.authorAttribution?.photoUri || null,
    rating: r.rating || 0,
    text: r.text?.text || "",
    relative_time: r.relativePublishTimeDescription || "",
    publish_time: r.publishTime || null,
  }));

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("google_places_cache")
    .upsert({
      tenant_id: tenantId,
      source_url: gbpUrl,
      place_id: details.id,
      display_name: details.displayName?.text || null,
      formatted_address: details.formattedAddress || null,
      rating: details.rating || null,
      user_rating_count: details.userRatingCount || 0,
      reviews,
      google_maps_uri: details.googleMapsUri || null,
      last_synced_at: new Date().toISOString(),
      last_sync_status: "ok",
      last_sync_error: null,
    }, { onConflict: "tenant_id" });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, place_id: details.id };
}

/** Read cached place data for a tenant (used by public site + admin). */
export async function getCachedPlaceData(tenantId: string) {
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("google_places_cache")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}
