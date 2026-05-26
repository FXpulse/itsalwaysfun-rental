"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface GalleryPhoto {
  url: string;
  alt: string;
}

/** Carousel: large main image + scrollable thumbnail row. Click main image to
 *  open a lightbox view. Supports keyboard arrow navigation in lightbox. */
export function ProductGallery({
  photos,
  productName,
}: {
  photos: GalleryPhoto[];
  productName: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-md">
        <div className="aspect-square flex items-center justify-center bg-slate-50 text-slate-300">
          No image available
        </div>
      </div>
    );
  }

  const active = photos[activeIdx];

  function next() {
    setActiveIdx((i) => (i + 1) % photos.length);
  }
  function prev() {
    setActiveIdx((i) => (i - 1 + photos.length) % photos.length);
  }

  return (
    <div>
      {/* Main image */}
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-md relative group">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block aspect-square relative bg-slate-50 w-full cursor-zoom-in"
          aria-label="View larger"
        >
          <Image
            src={active.url}
            alt={active.alt || productName}
            fill
            className="object-contain"
            priority
            unoptimized
          />
        </button>
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow opacity-0 group-hover:opacity-100 transition"
            >
              <ChevronLeft className="h-4 w-4 text-brand-navy" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white border border-slate-200 rounded-full p-2 shadow opacity-0 group-hover:opacity-100 transition"
            >
              <ChevronRight className="h-4 w-4 text-brand-navy" />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs rounded px-2 py-0.5">
              {activeIdx + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {photos.map((p, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex-shrink-0 h-16 w-16 rounded-md overflow-hidden border-2 transition ${
                i === activeIdx
                  ? "border-brand-navy ring-2 ring-brand-navy/30"
                  : "border-slate-200 hover:border-slate-400"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.alt || `${productName} photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(false);
            if (e.key === "ArrowRight") next();
            if (e.key === "ArrowLeft") prev();
          }}
          tabIndex={0}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(false);
            }}
            aria-label="Close"
            className="absolute top-4 right-4 text-white hover:text-brand-yellow"
          >
            <X className="h-8 w-8" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous"
                className="absolute left-4 text-white hover:text-brand-yellow"
              >
                <ChevronLeft className="h-10 w-10" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next"
                className="absolute right-4 text-white hover:text-brand-yellow"
              >
                <ChevronRight className="h-10 w-10" />
              </button>
            </>
          )}
          <div className="relative max-w-5xl max-h-[85vh] w-full h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.url}
              alt={active.alt || productName}
              className="w-full h-full object-contain"
            />
          </div>
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm rounded-full px-3 py-1">
              {activeIdx + 1} / {photos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
