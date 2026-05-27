import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantBusinessName } from "@/lib/tenant/business";
import { Star, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getTenantBusinessName();
  return {
    title: `Customer Reviews — ${name}`,
    description: `What customers say about ${name}.`,
  };
}

const SOURCE_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  yelp: "Yelp",
  instagram: "Instagram",
  email: "Direct",
  manual: "",
};

export default async function PublicReviewsPage() {
  const supabase = createAdminClient();
  const [{ data: reviewsData }, { data: settingsRows }] = await Promise.all([
    supabase
      .from("customer_reviews")
      .select(
        "id, customer_name, customer_location, review_text, rating, photo_url, source, reviewed_at",
      )
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("sort_order")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["google_review_url", "reviews_section_title"]),
  ]);

  const reviews = reviewsData || [];
  const map = new Map((settingsRows as any[] || []).map((r) => [r.key, r.value]));
  const googleReviewUrl = map.get("google_review_url") || "";
  const title = map.get("reviews_section_title") || "Customer Reviews";

  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy mb-3">
          {title}
        </h1>
        {avgRating && (
          <div className="flex justify-center items-center gap-2 mb-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-6 w-6 ${
                    i < Math.round(parseFloat(avgRating))
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200"
                  }`}
                />
              ))}
            </div>
            <strong className="text-2xl text-brand-navy">{avgRating}</strong>
            <span className="text-sm text-slate-500">
              from {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
        {googleReviewUrl && (
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-brand-yellow text-brand-navy font-bold px-5 py-2.5 rounded hover:bg-yellow-300 transition mt-2"
          >
            ⭐ Leave us a Google review <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="card text-center text-slate-400 py-12">
          No reviews yet. Be the first!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((r: any) => (
            <article key={r.id} className="card border border-slate-200">
              <div className="flex items-center gap-3 mb-3">
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photo_url}
                    alt={r.customer_name}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold flex-shrink-0">
                    {r.customer_name[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-brand-navy">{r.customer_name}</div>
                  <div className="text-xs text-slate-500">
                    {r.customer_location}
                    {r.customer_location && SOURCE_LABEL[r.source] && " · "}
                    {SOURCE_LABEL[r.source] || ""}
                    {r.reviewed_at && ` · ${new Date(r.reviewed_at).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-700 italic">"{r.review_text}"</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
