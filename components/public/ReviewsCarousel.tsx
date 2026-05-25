"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface Review {
  id: string;
  customer_name: string;
  customer_location: string | null;
  review_text: string;
  rating: number;
  photo_url: string | null;
  source: string;
  reviewed_at: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  yelp: "Yelp",
  instagram: "Instagram",
  email: "Direct",
  manual: "",
};

export function ReviewsCarousel({
  reviews,
  title = "What Our Customers Are Saying",
  googleReviewUrl,
}: {
  reviews: Review[];
  title?: string;
  googleReviewUrl?: string;
}) {
  const [idx, setIdx] = useState(0);
  const visible = 3; // desktop shows 3 at a time

  useEffect(() => {
    if (reviews.length <= visible) return;
    const id = setInterval(() => {
      setIdx((prev) => (prev + 1) % reviews.length);
    }, 7000);
    return () => clearInterval(id);
  }, [reviews.length]);

  if (reviews.length === 0) return null;

  // Build the visible window (wrap around if needed)
  const windowList: Review[] = [];
  for (let i = 0; i < Math.min(visible, reviews.length); i++) {
    windowList.push(reviews[(idx + i) % reviews.length]);
  }

  return (
    <section className="bg-white border-t border-b border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-brand-navy mb-1">
            {title}
          </h2>
          <p className="text-sm text-slate-500">Real reviews from real families</p>
        </div>

        <div className="relative">
          {reviews.length > visible && (
            <>
              <button
                onClick={() => setIdx((i) => (i - 1 + reviews.length) % reviews.length)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 sm:-ml-4 z-10 bg-white border border-slate-200 rounded-full p-2 shadow hover:bg-slate-50"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4 text-brand-navy" />
              </button>
              <button
                onClick={() => setIdx((i) => (i + 1) % reviews.length)}
                className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 sm:-mr-4 z-10 bg-white border border-slate-200 rounded-full p-2 shadow hover:bg-slate-50"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4 text-brand-navy" />
              </button>
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {windowList.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </div>

        <div className="text-center mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/reviews"
            className="inline-flex items-center gap-1 text-brand-navy font-semibold hover:text-brand-yellow-dark"
          >
            See all reviews →
          </Link>
          {googleReviewUrl && (
            <>
              <span className="text-slate-300">·</span>
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-brand-yellow text-brand-navy font-semibold px-4 py-2 rounded hover:bg-yellow-300 transition text-sm"
              >
                Leave us a Google review <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const source = SOURCE_LABEL[review.source] || "";
  return (
    <div className="bg-slate-50 rounded-lg p-5 border border-slate-100">
      <div className="flex items-center gap-3 mb-3">
        {review.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.photo_url}
            alt={review.customer_name}
            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold flex-shrink-0">
            {review.customer_name[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-brand-navy text-sm truncate">
            {review.customer_name}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {review.customer_location}
            {review.customer_location && source && " · "}
            {source}
          </div>
        </div>
      </div>
      <div className="flex gap-0.5 mb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-slate-700 italic line-clamp-5">
        "{review.review_text}"
      </p>
    </div>
  );
}
