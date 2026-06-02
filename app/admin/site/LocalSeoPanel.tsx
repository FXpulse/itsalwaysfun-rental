"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MapPin,
  Globe,
  DollarSign,
  Save,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Star,
} from "lucide-react";
import { saveLocalSeo, refreshPlacesCache } from "./local-seo-actions";

interface Initial {
  business_address: string;
  service_area: string;
  geo_latitude: string;
  geo_longitude: string;
  price_range: string;
  google_business_profile_url: string;
  seo_google_verification: string;
}

interface PlacesStatus {
  configured: boolean;
  cached: null | {
    place_id: string;
    display_name: string | null;
    rating: number | null;
    review_count: number;
    last_synced_at: string;
    sync_status: string;
    sync_error: string | null;
  };
}

export function LocalSeoPanel({
  initial,
  placesStatus,
}: {
  initial: Initial;
  placesStatus?: PlacesStatus;
}) {
  const [serviceArea, setServiceArea] = useState(initial.service_area);
  const [lat, setLat] = useState(initial.geo_latitude);
  const [lon, setLon] = useState(initial.geo_longitude);
  const [priceRange, setPriceRange] = useState(initial.price_range || "$$");
  const [gbpUrl, setGbpUrl] = useState(initial.google_business_profile_url);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Score: how complete is the Local SEO setup?
  const checks = [
    { label: "Business address set", done: !!initial.business_address.trim() },
    { label: "Service area cities (comma-separated)", done: serviceArea.split(",").length >= 2 },
    { label: "Geo coordinates set", done: !!lat && !!lon },
    { label: "Price range set", done: !!priceRange },
    { label: "Google Business Profile linked", done: !!gbpUrl },
    { label: "Search Console verified", done: !!initial.seo_google_verification },
  ];
  const completed = checks.filter((c) => c.done).length;
  const score = Math.round((completed / checks.length) * 100);

  function handleSave() {
    startTransition(async () => {
      const res = await saveLocalSeo({
        service_area: serviceArea,
        geo_latitude: lat,
        geo_longitude: lon,
        price_range: priceRange,
        google_business_profile_url: gbpUrl,
      });
      if (!res.ok) {
        toast.error(res.error || "Failed to save");
        return;
      }
      setSaved(true);
      const placesErr = (res as any).placesSyncError;
      if (placesErr) {
        toast.warning(`Saved, but Google Places sync had an issue: ${placesErr}`);
      } else {
        toast.success("Local SEO settings saved");
      }
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="card mb-6 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-xl p-2.5 shrink-0">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-brand-navy">Local SEO + Google Business</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Help Google rank you in &ldquo;near me&rdquo; searches and Maps. Each field is optional —
            blank fields won&apos;t appear in your structured data, no risk of broken markup.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-3xl font-bold ${score === 100 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-slate-400"}`}>
            {score}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">complete</div>
        </div>
      </div>

      {/* Completeness checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-5">
        {checks.map((c) => (
          <div key={c.label} className="text-xs flex items-center gap-1.5 text-slate-700">
            {c.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            )}
            <span className={c.done ? "" : "text-slate-400"}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Service area */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 mb-1.5">
            Service area cities
          </label>
          <textarea
            value={serviceArea}
            onChange={(e) => setServiceArea(e.target.value)}
            rows={2}
            placeholder="Jacksonville, Saint Johns, Ponte Vedra, Orange Park"
            className="input w-full"
            disabled={isPending}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Comma-separated list of cities you deliver to. Each becomes a separate City entity in
            schema markup, which boosts &ldquo;bouncer rental Saint Johns&rdquo; type searches.
          </p>
        </div>

        {/* Geo coordinates */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 mb-1.5">
            Business coordinates (lat / lon)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="30.3322"
              className="input"
              disabled={isPending}
            />
            <input
              type="text"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="-81.6557"
              className="input"
              disabled={isPending}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
            <span>
              Open <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(initial.business_address || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
              >Google Maps <ExternalLink className="h-2.5 w-2.5" /></a>, right-click your pin, copy the coordinates that appear at the top.
            </span>
          </p>
        </div>

        {/* Price range */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-slate-600 mb-1.5">
            Price range
          </label>
          <div className="flex gap-2">
            {["$", "$$", "$$$", "$$$$"].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriceRange(p)}
                disabled={isPending}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${
                  priceRange === p
                    ? "bg-brand-navy text-white shadow-md"
                    : "bg-white border border-slate-300 text-slate-600 hover:border-brand-navy"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            $ budget · $$ mid-range (typical for party rentals) · $$$ premium · $$$$ luxury
          </p>
        </div>

        {/* Google Business Profile */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-blue-700" />
            <h3 className="font-bold text-blue-900 text-sm">Google Business Profile</h3>
          </div>
          <p className="text-xs text-blue-900 mb-3">
            Your Google Business listing is what shows up in the right-side panel when someone
            googles your business. Linking it here connects your website to it (sameAs in
            structured data), which helps Google trust both pages and rank you higher locally.
          </p>

          <label className="block text-xs uppercase tracking-wider font-semibold text-blue-900 mb-1.5">
            GBP profile URL
          </label>
          <input
            type="url"
            value={gbpUrl}
            onChange={(e) => setGbpUrl(e.target.value)}
            placeholder="https://g.page/your-business or https://maps.google.com/..."
            className="input w-full"
            disabled={isPending}
          />
          <div className="text-[11px] text-blue-800 mt-2 space-y-1">
            <div>
              <strong>Don&apos;t have one?</strong>{" "}
              <a
                href="https://business.google.com/create"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 hover:underline inline-flex items-center gap-0.5"
              >
                Create it at business.google.com <ExternalLink className="h-2.5 w-2.5" />
              </a>
              {" "}— takes 5 minutes, free, biggest local-SEO boost there is.
            </div>
            <div>
              <strong>Already have one?</strong>{" "}
              <a
                href="https://business.google.com/locations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 hover:underline inline-flex items-center gap-0.5"
              >
                business.google.com/locations <ExternalLink className="h-2.5 w-2.5" />
              </a>
              {" "}→ click your business → top-right share button → copy URL.
            </div>
          </div>

          {/* Quick actions if URL is set */}
          {gbpUrl && (
            <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-2 gap-2 text-xs">
              <a
                href={gbpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 inline-flex items-center justify-center gap-1 font-semibold"
              >
                <ExternalLink className="h-3 w-3" /> Open profile
              </a>
              <a
                href={`${gbpUrl}/review`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 rounded-lg px-3 py-2 inline-flex items-center justify-center gap-1 font-semibold"
              >
                <Search className="h-3 w-3" /> Review link
              </a>
            </div>
          )}

          {/* Places API sync status — shown only when API is configured */}
          {placesStatus?.configured && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              {placesStatus.cached ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-emerald-900 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Synced with Google Places
                    </div>
                    <SyncNowButton />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-emerald-700">Rating</div>
                      <div className="font-bold text-emerald-900 inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {placesStatus.cached.rating?.toFixed(1) || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-emerald-700">Reviews</div>
                      <div className="font-bold text-emerald-900">{placesStatus.cached.review_count}</div>
                    </div>
                    <div>
                      <div className="text-emerald-700">Last sync</div>
                      <div className="font-bold text-emerald-900 text-[10px]">
                        {new Date(placesStatus.cached.last_synced_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald-700 mt-2">
                    Synced daily at 10am UTC. Cached data feeds the LocalBusiness schema on your homepage so Google shows stars in search results.
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-amber-900">Not synced with Google Places yet</div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Save your GBP URL above + click Sync to pull rating + reviews.
                    </p>
                  </div>
                  <SyncNowButton />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Console reminder */}
        {!initial.seo_google_verification && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <strong>Search Console not verified.</strong> Once verified, Google sends you alerts
              about indexing issues, ranking drops, and shows what queries bring traffic. Go to{" "}
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:underline inline-flex items-center gap-0.5"
              >
                search.google.com/search-console <ExternalLink className="h-2.5 w-2.5" />
              </a>
              {" "}and paste the verification token in the SEO section below.
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Saves to <code className="bg-slate-100 px-1 rounded">site_settings</code> — applies to the public site immediately.
          </p>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-700 font-semibold">✓ Saved</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              <Save className="h-4 w-4" />
              {isPending ? "Saving..." : "Save Local SEO"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncNowButton() {
  const [isPending, startTransition] = useTransition();
  function handleSync() {
    startTransition(async () => {
      const res = await refreshPlacesCache();
      if (!res.ok) {
        toast.error(res.error || "Sync failed");
        return;
      }
      toast.success("Synced — refresh to see updates");
      setTimeout(() => window.location.reload(), 800);
    });
  }
  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isPending}
      className="text-xs bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded px-2 py-1 inline-flex items-center gap-1 font-semibold shrink-0"
    >
      <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Syncing..." : "Sync now"}
    </button>
  );
}
