import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { Star, ExternalLink } from "lucide-react";
import { ReviewsManager } from "./ReviewsManager";

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
  const [{ data: reviews }, { data: settingsRows }] = await Promise.all([
    supabase
      .from("customer_reviews")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("created_at", { ascending: false }),
    supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", "google_review_url"),
  ]);

  const list = (reviews as ReviewRow[]) || [];
  const featuredCount = list.filter((r) => r.is_featured && r.is_active).length;
  const activeCount = list.filter((r) => r.is_active).length;
  const avgRating = activeCount
    ? (list.filter((r) => r.is_active).reduce((s, r) => s + r.rating, 0) / activeCount).toFixed(1)
    : "—";

  const googleReviewUrl =
    ((settingsRows as any[])?.[0]?.value as string) || "";

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

      <ReviewsManager reviews={list} />
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
