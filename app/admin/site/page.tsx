import Link from "next/link";
import { Sparkles, ArrowRight, MapPin } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { isPlacesConfigured } from "@/lib/google-places/client";
import { getCachedPlaceData } from "@/lib/google-places/sync";
import { SiteSettingsForm } from "./SiteSettingsForm";
import { LocalSeoPanel } from "./LocalSeoPanel";

export const dynamic = "force-dynamic";

interface SettingRow {
  key: string;
  value: string | null;
  description: string | null;
  category: string;
}

export default async function AdminSitePage() {
  const supabase = createAdminClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("key, value, description, category")
    .order("category")
    .order("key");

  // Group by category — explicit Record<string, SettingRow[]> so TS is happy
  const grouped: Record<string, SettingRow[]> = {};
  // Flat lookup by key for the LocalSeoPanel below
  const settingsMap = new Map<string, string>();
  for (const s of (settings as SettingRow[] | null) || []) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category]!.push(s);
    if (s.value !== null) settingsMap.set(s.key, s.value);
  }

  // Google Places cache snapshot for the LocalSeoPanel
  const tenantId = getCurrentTenantId();
  const placesConfigured = isPlacesConfigured();
  const cachedPlace = placesConfigured ? await getCachedPlaceData(tenantId) : null;
  const placesStatus = {
    configured: placesConfigured,
    cached: cachedPlace
      ? {
          place_id: (cachedPlace as any).place_id,
          display_name: (cachedPlace as any).display_name,
          rating: (cachedPlace as any).rating ? Number((cachedPlace as any).rating) : null,
          review_count: (cachedPlace as any).user_rating_count || 0,
          last_synced_at: (cachedPlace as any).last_synced_at,
          sync_status: (cachedPlace as any).last_sync_status,
          sync_error: (cachedPlace as any).last_sync_error,
        }
      : null,
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">
        Website Content
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Edit logo, business info, and all text shown on the public website.
        Changes apply immediately (no redeploy needed).
      </p>

      {/* Mini-builder shortcut */}
      <Link
        href="/admin/site/sections"
        className="block mb-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 ring-1 ring-emerald-200 p-4 hover:shadow-md transition group"
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl p-2.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800 group-hover:text-emerald-700">
              Add extra sections to your home page
            </h3>
            <p className="text-xs text-slate-600">
              Stats banner, "Why choose us", custom CTA banner, custom HTML — turn them on/off with one click.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      {/* Local SEO + Google Business — dedicated panel above the bulk editor.
          Shows the most impactful SEO fields with helpful UI (lookup links,
          format hints, validation). The bulk settings form below still
          renders these same keys so power users can edit them there too. */}
      <LocalSeoPanel
        initial={{
          business_address: settingsMap.get("business_address") || "",
          service_area: settingsMap.get("service_area") || "",
          geo_latitude: settingsMap.get("geo_latitude") || "",
          geo_longitude: settingsMap.get("geo_longitude") || "",
          price_range: settingsMap.get("price_range") || "",
          google_business_profile_url: settingsMap.get("google_business_profile_url") || "",
          google_places_manual_place_id: settingsMap.get("google_places_manual_place_id") || "",
          seo_google_verification: settingsMap.get("seo_google_verification") || "",
        }}
        placesStatus={placesStatus}
      />

      <SiteSettingsForm groupedSettings={grouped} />
    </div>
  );
}
