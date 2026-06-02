import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { Star, ExternalLink } from "lucide-react";
import { ReviewsManager } from "./ReviewsManager";
import { getTenantInfo } from "@/lib/tenant/business";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { getCachedPlaceData } from "@/lib/google-places/sync";
import { GooglePlacesPanel } from "./GooglePlacesPanel";

export const dynamic = "force-dynamic";

export interface ReviewRow {
  id: string;
  customer_name: string;
  customer_location: string | null;
  review_text: string;
  rating: number;
  photo_url: string | null;
  source: "google" | "facebook" | "manual" | "yelp" | "instagram" | "email";
  source_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  reviewed_at: string | null;
  created_at: string;
}

export default async function AdminReviewsPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const tenantId = getCurrentTenantId();
  const [{ data: reviews }, { data: settingsRows }, placeCache] = await Promise.all([
    supabase
      .from("customer_reviews")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["google_review_url", "google_business_profile_url"]),
    getCachedPlaceData(tenantId).catch(() => null),
  ]);

  const list = (reviews as ReviewRow[]) || [];

  // Build a set of imported google review texts (text+author) so the panel
  // can show ✓ "Already on site" instead of the Import button
  const alreadyImportedTexts = new Set(
    list
      .filter((r) => r.source === "google")
      .map((r) => r.review_text.trim()),
  );

  // Convert cached place data → typed shape the panel expects
  const cachedPlace = placeCache
    ? {
        place_id: (placeCache as any).place_id,
        display_name: (placeCache as any).display_name,
        rating: (placeCache as any).rating ? Number((placeCache as any).rating) : null,
        user_rating_count: (placeCache as any).user_rating_count || 0,
        reviews: ((placeCache as any).reviews as any[]) || [],
        google_maps_uri: (placeCache as any).google_maps_uri,
        last_synced_at: (placeCache as any).last_synced_at,
        last_sync_status: (placeCache as any).last_sync_status,
        last_sync_error: (placeCache as any).last_sync_error,
      }
    : null;
  const featuredCount = list.filter((r) => r.is_featured && r.is_active).length;
  const activeCount = list.filter((r) => r.is_active).length;
  const avgRating = activeCount
    ? (list.filter((r) => r.is_active).reduce((s, r) => s + r.rating, 0) / activeCount).toFixed(1)
    : "—";

  const settingsMap = new Map<string, string>(
    ((settingsRows as any[]) || []).map((r) => [r.key, r.value || ""]),
  );
  const googleReviewUrl = settingsMap.get("google_review_url") || "";

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Star className="h-6 w-6" /> Customer Reviews
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Curate testimonials shown on the public site. Add reviews from Google,
        Facebook, or emailed feedback. Mark the best ones <strong>Featured</strong>{" "}
        to show them in the homepage carousel.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Featured (carousel)" value={String(featuredCount)} accent />
        <Stat label="Average rating" value={`${avgRating} ★`} />
        <Stat label="Total" value={String(list.length)} />
      </div>

      {googleReviewUrl && (
        <div className="card mb-6 bg-blue-50 border-l-4 border-l-blue-500 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <strong className="text-brand-navy">"Leave us a review" link</strong>
              <p className="text-xs text-slate-600">
                Sent in review-request emails + shown as a CTA on the /reviews
                page. Edit at <a href="/admin/site" className="underline">Website content → reviews category</a>.
              </p>
            </div>
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 whitespace-nowrap"
            >
              Open link <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Live Google reviews from Places API (works as soon as
          GOOGLE_PLACES_API_KEY env var is set and tenant pastes their GBP URL
          in /admin/site). Each cached review has an "Import to site" button. */}
      <GooglePlacesPanel
        place={cachedPlace}
        alreadyImportedTexts={alreadyImportedTexts}
        reviewWriteUrl={googleReviewUrl}
      />

      <ReviewsManager reviews={list} tz={tz} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card py-3 ${accent ? "bg-amber-50 border-amber-200" : ""}`}>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold text-brand-navy mt-1">{value}</div>
    </div>
  );
}
