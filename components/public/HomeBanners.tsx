"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Banner {
  id: string;
  image_url: string;
  alt_text: string | null;
  link_url: string | null;
}

const AUTO_ROTATE_MS = 5000;

export function HomeBanners({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  const total = banners.length;

  const next = useCallback(() => {
    setIdx((i) => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setIdx((i) => (i - 1 + total) % total);
  }, [total]);

  // Auto-rotate every 5s (only if >1 banner)
  useEffect(() => {
    if (total <= 1) return;
    const id = setInterval(next, AUTO_ROTATE_MS);
    return () => clearInterval(id);
  }, [next, total]);

  if (total === 0) return null;

  return (
    <section className="relative w-full bg-slate-100 overflow-hidden">
      {/* Slides */}
      <div className="relative aspect-[16/5] sm:aspect-[16/4] lg:aspect-[1920/600] w-full">
        {banners.map((b, i) => {
          const slide = (
            <div className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
            >
              <Image
                src={b.image_url}
                alt={b.alt_text || "Banner"}
                fill
                className="object-cover"
                priority={i === 0}
                unoptimized
              />
            </div>
          );
          return (
            <div key={b.id} className="absolute inset-0">
              {b.link_url ? (
                <Link href={b.link_url} className="block w-full h-full">
                  {slide}
                </Link>
              ) : (
                slide
              )}
            </div>
          );
        })}
      </div>

      {/* Controls (only if >1 banner) */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-brand-navy rounded-full p-2 shadow z-10 transition"
            aria-label="Previous banner"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-brand-navy rounded-full p-2 shadow z-10 transition"
            aria-label="Next banner"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-2 rounded-full transition-all ${
                  i === idx ? "w-6 bg-brand-yellow" : "w-2 bg-white/60 hover:bg-white"
                }`}
                aria-label={`Go to banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
