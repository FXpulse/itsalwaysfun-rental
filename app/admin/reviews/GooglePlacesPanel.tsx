// Read-only widget on /admin/reviews showing the live Google Business
// Profile reviews cached from Places API. Each review has an "Import to
// site" button (copies into customer_reviews) + "Reply on Google" link
// that opens the GBP listing in a new tab so the operator can respond
// there (until OAuth gets approved and we can reply via API).

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Star,
  ExternalLink,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { refreshPlacesCache } from "@/app/admin/site/local-seo-actions";
import { importGoogleReview } from "./google-import-actions";

interface CachedReview {
  author: string;
  photo_url: string | null;
  rating: number;
  text: string;
  relative_time: string;
  publish_time: string | null;
}

interface CachedPlace {
  place_id: string;
  display_name: string | null;
  rating: number | null;
  user_rating_count: number;
  reviews: CachedReview[];
  google_maps_uri: string | null;
  last_synced_at: string;
  last_sync_status: string;
  last_sync_error: string | null;
}

export function GooglePlacesPanel({
  place,
  alreadyImportedTexts,
  reviewWriteUrl,
}: {
  place: CachedPlace | null;
  alreadyImportedTexts: Set<string>;
  reviewWriteUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [importingIdx, setImportingIdx] = useState<number | null>(null);

  function handleRefresh() {
    startTransition(async () => {
      const r = await refreshPlacesCache();
      if (!r.ok) {
        toast.error(r.error || "Sync failed");
        return;
      }
      toast.success("Synced — reloading");
      setTimeout(() => window.location.reload(), 600);
    });
  }

  function handleImport(idx: number, review: CachedReview) {
    setImportingIdx(idx);
    startTransition(async () => {
      const r = await importGoogleReview({
        author: review.author,
        rating: review.rating,
        text: review.text,
        publishTime: review.publish_time,
        sourceUrl: place?.google_maps_uri || "",
      });
      setImportingIdx(null);
      if (!r.ok) {
        toast.error(r.error || "Import failed");
        return;
      }
      toast.success("Imported to customer reviews");
      setTimeout(() => window.location.reload(), 800);
    });
  }

  if (!place) {
    return (
      <div className="card mb-6 bg-slate-50 border-2 border-dashed border-slate-200">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-slate-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-slate-700 text-sm">
              Google Business Profile not connected
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Paste your GBP URL in{" "}
              <a href="/admin/site" className="text-indigo-600 underline">
                Website Content → Local SEO
              </a>{" "}
              to pull your live rating + recent reviews from Google.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-xl p-2.5 shrink-0">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-brand-navy text-lg">
              Live Google reviews
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {place.display_name || "Your business"} · cached from Google Places API
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="text-xs bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1 font-semibold"
        >
          <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
          Sync now
        </button>
      </div>

      {/* Aggregate */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Rating</div>
          <div className="text-2xl font-bold text-brand-navy inline-flex items-center gap-1">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            {place.rating?.toFixed(1) || "—"}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total reviews</div>
          <div className="text-2xl font-bold text-brand-navy">{place.user_rating_count}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-slate-200">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Last synced</div>
          <div className="text-sm font-semibold text-brand-navy mt-1">
            {new Date(place.last_synced_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {place.google_maps_uri && (
          <a
            href={place.google_maps_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 inline-flex items-center justify-center gap-1 font-semibold text-xs"
          >
            <ExternalLink className="h-3 w-3" /> Open on Google Maps
          </a>
        )}
        {reviewWriteUrl && (
          <a
            href={reviewWriteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 inline-flex items-center justify-center gap-1 font-semibold text-xs"
          >
            <Star className="h-3 w-3" /> Share &ldquo;leave a review&rdquo;
          </a>
        )}
      </div>

      {/* Sync error if any */}
      {place.last_sync_status !== "ok" && place.last_sync_error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-900">
            <strong>Sync warning:</strong> {place.last_sync_error}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {place.reviews.length === 0 ? (
        <div className="text-center text-xs text-slate-500 py-6 bg-white border border-dashed border-slate-200 rounded-lg">
          No reviews from Google Places yet. Sync after a customer leaves a review.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Most recent reviews ({place.reviews.length})
          </div>
          {place.reviews.map((r, idx) => {
            const isImported = alreadyImportedTexts.has(r.text.trim());
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-lg p-3"
              >
                <div className="flex items-start gap-3">
                  {r.photo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.photo_url}
                      alt={r.author}
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {r.author?.[0] || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-brand-navy">{r.author}</span>
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                          />
                        ))}
                      </span>
                      <span className="text-[10px] text-slate-500">{r.relative_time}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line">{r.text}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                  {reviewWriteUrl && (
                    <a
                      href={reviewWriteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-600 hover:text-brand-navy inline-flex items-center gap-1"
                      title="Reply directly on Google Business Profile (until OAuth approved)"
                    >
                      <ExternalLink className="h-2.5 w-2.5" /> Reply on Google
                    </a>
                  )}
                  {isImported ? (
                    <span className="text-[10px] text-emerald-700 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Already on site
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleImport(idx, r)}
                      disabled={isPending && importingIdx === idx}
                      className="text-[10px] bg-brand-yellow text-brand-navy font-bold rounded px-2 py-1 hover:bg-yellow-300 inline-flex items-center gap-1"
                      title="Add this review to the customer_reviews shown on your public site"
                    >
                      <Download className="h-3 w-3" />
                      {isPending && importingIdx === idx ? "Importing..." : "Import to site"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-500 mt-4 text-center">
        Daily auto-sync at 10am UTC. Replying to reviews directly inside RentalFlow will be available once Business Profile API approval lands.
      </p>
    </div>
  );
}
