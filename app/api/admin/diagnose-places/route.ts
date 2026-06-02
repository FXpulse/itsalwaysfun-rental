// Diagnostic endpoint — superadmin only. Runs the full Google Places
// resolution against the tenant's saved GBP URL and returns every
// intermediate step so the operator can see exactly what's failing
// without digging through Vercel function logs.
//
// GET /api/admin/diagnose-places
// Returns JSON with: env var status, URL parsing, API call results.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/db";
import {
  isPlacesConfigured,
  extractPlaceIdentifier,
  searchPlaceByText,
  resolveBusinessFromUrl,
} from "@/lib/google-places/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  // Auth gate — any logged-in admin (so tenants can self-debug)
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabaseUnscoped = createAdminClient({ unscoped: true });
  const { data: role } = await supabaseUnscoped
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!role || ((role as any).role !== "admin" && !(role as any).is_superadmin)) {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient();

  const out: any = {
    timestamp: new Date().toISOString(),
    tenant_id: tenantId,
    env: {
      GOOGLE_PLACES_API_KEY_set: !!process.env.GOOGLE_PLACES_API_KEY,
      GOOGLE_PLACES_API_KEY_length: process.env.GOOGLE_PLACES_API_KEY?.length || 0,
      GOOGLE_PLACES_API_KEY_prefix: process.env.GOOGLE_PLACES_API_KEY?.substring(0, 8) || null,
      isPlacesConfigured: isPlacesConfigured(),
    },
  };

  // 1. Read the saved URL
  const { data: row } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "google_business_profile_url")
    .maybeSingle();
  const savedUrl = (row as any)?.value || "";
  out.saved_url = savedUrl;

  if (!savedUrl) {
    out.error = "No google_business_profile_url saved in site_settings";
    return NextResponse.json(out);
  }

  // 2. Try to extract identifier
  try {
    const extracted = await extractPlaceIdentifier(savedUrl);
    out.extracted = extracted;
  } catch (e: any) {
    out.extracted_error = e?.message || String(e);
  }

  // 3. Make a raw test call to Places API to verify key works
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const testRes = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ textQuery: "starbucks", maxResultCount: 1 }),
        }
      );
      out.api_test = {
        status: testRes.status,
        ok: testRes.ok,
        body: (await testRes.text()).slice(0, 800),
      };
    } catch (e: any) {
      out.api_test_error = e?.message || String(e);
    }
  }

  // 4. Also try the redirect follow manually
  if (/g\.page|maps\.app\.goo\.gl/.test(savedUrl)) {
    try {
      const redirectRes = await fetch(savedUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });
      out.redirect_test = {
        original: savedUrl,
        final_url: redirectRes.url,
        status: redirectRes.status,
        redirected: redirectRes.url !== savedUrl,
      };
    } catch (e: any) {
      out.redirect_test_error = e?.message || String(e);
    }
  }

  // 5a. RAW API test — call searchText directly with the extracted query
  // so we can see the full response body (the helper returns null silently)
  if (process.env.GOOGLE_PLACES_API_KEY && out.extracted?.query) {
    const variants = [
      { label: "exact_with_bias", query: out.extracted.query, bias: out.extracted.businessLat ? { lat: out.extracted.businessLat, lon: out.extracted.businessLon } : null, radius: 5000 },
      { label: "exact_no_bias", query: out.extracted.query, bias: null, radius: 0 },
      { label: "exact_50km_bias", query: out.extracted.query, bias: out.extracted.businessLat ? { lat: out.extracted.businessLat, lon: out.extracted.businessLon } : null, radius: 50000 },
      { label: "with_city", query: `${out.extracted.query} Jacksonville FL`, bias: null, radius: 0 },
      { label: "with_state", query: `${out.extracted.query} Florida`, bias: null, radius: 0 },
      { label: "no_apostrophe_with_city", query: `${out.extracted.query.replace(/['']/g, "")} Jacksonville FL`, bias: null, radius: 0 },
    ];
    out.raw_search_variants = [];
    for (const v of variants) {
      const body: any = { textQuery: v.query, maxResultCount: 3 };
      if (v.bias) {
        body.locationBias = {
          circle: {
            center: { latitude: v.bias.lat, longitude: v.bias.lon },
            radius: v.radius,
          },
        };
      }
      try {
        const r = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
          method: "POST",
          headers: {
            "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const txt = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch { /* not JSON */ }
        out.raw_search_variants.push({
          label: v.label,
          query: v.query,
          radius: v.radius,
          status: r.status,
          ok: r.ok,
          place_count: parsed?.places?.length || 0,
          first_match: parsed?.places?.[0]
            ? {
                id: parsed.places[0].id,
                name: parsed.places[0].displayName?.text,
                address: parsed.places[0].formattedAddress,
                rating: parsed.places[0].rating,
                reviews: parsed.places[0].userRatingCount,
              }
            : null,
          all_matches: (parsed?.places || []).map((p: any) => ({
            name: p.displayName?.text,
            address: p.formattedAddress,
          })),
          raw_body_preview: !r.ok ? txt.slice(0, 400) : undefined,
        });
      } catch (e: any) {
        out.raw_search_variants.push({ label: v.label, query: v.query, error: e?.message || String(e) });
      }
    }
  }

  // 5b. ALTERNATE LOOKUP STRATEGIES — text search failed, so try:
  //   - Autocomplete (often finds listings text-search misses)
  //   - Direct GET places/<FTID> (FTID extracted from !1s param in URL)
  //   - Direct GET places/<GMID> (/g/... from !16s param in URL)
  //   - Nearby search (200m radius around the pin)
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY!;
    out.alt_lookups = {};

    // Extract FTID and GMID from the saved URL
    const ftidMatch = savedUrl.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    const gmidMatch = savedUrl.match(/!16s%2F([^%/?&!]+)%2F([^%/?&!]+)/);
    out.alt_lookups.ftid = ftidMatch?.[1] || null;
    out.alt_lookups.gmid = gmidMatch ? `/${gmidMatch[1]}/${gmidMatch[2]}` : null;

    // Test 1: Autocomplete with bias (often surfaces niche listings)
    if (out.extracted?.query) {
      try {
        const acBody: any = {
          input: out.extracted.query,
          includedPrimaryTypes: [],
        };
        if (out.extracted.businessLat) {
          acBody.locationBias = {
            circle: {
              center: { latitude: out.extracted.businessLat, longitude: out.extracted.businessLon },
              radius: 10000,
            },
          };
        }
        const r = await fetch(`https://places.googleapis.com/v1/places:autocomplete`, {
          method: "POST",
          headers: { "X-Goog-Api-Key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(acBody),
        });
        const txt = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch {}
        out.alt_lookups.autocomplete = {
          status: r.status,
          suggestion_count: parsed?.suggestions?.length || 0,
          first_5: (parsed?.suggestions || []).slice(0, 5).map((s: any) => ({
            place_id: s?.placePrediction?.placeId,
            text: s?.placePrediction?.text?.text,
            structured: s?.placePrediction?.structuredFormat?.mainText?.text,
          })),
          raw_preview: !r.ok ? txt.slice(0, 400) : undefined,
        };
      } catch (e: any) {
        out.alt_lookups.autocomplete_error = e?.message || String(e);
      }
    }

    // Test 2: Direct GET with FTID
    if (out.alt_lookups.ftid) {
      try {
        const r = await fetch(
          `https://places.googleapis.com/v1/places/${encodeURIComponent(out.alt_lookups.ftid)}?languageCode=en`,
          {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,userRatingCount",
            },
          },
        );
        const txt = await r.text();
        out.alt_lookups.ftid_direct = {
          status: r.status,
          ok: r.ok,
          body_preview: txt.slice(0, 600),
        };
      } catch (e: any) {
        out.alt_lookups.ftid_direct_error = e?.message || String(e);
      }
    }

    // Test 3: Nearby search around the pin (very small radius — should
    // surface every business within 200m, including this one)
    if (out.extracted?.businessLat) {
      try {
        const r = await fetch(`https://places.googleapis.com/v1/places:searchNearby`, {
          method: "POST",
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locationRestriction: {
              circle: {
                center: { latitude: out.extracted.businessLat, longitude: out.extracted.businessLon },
                radius: 500,
              },
            },
            maxResultCount: 20,
          }),
        });
        const txt = await r.text();
        let parsed: any = null;
        try { parsed = JSON.parse(txt); } catch {}
        out.alt_lookups.nearby = {
          status: r.status,
          ok: r.ok,
          place_count: parsed?.places?.length || 0,
          places: (parsed?.places || []).map((p: any) => ({
            id: p.id,
            name: p.displayName?.text,
            address: p.formattedAddress,
          })),
          raw_preview: !r.ok ? txt.slice(0, 400) : undefined,
        };
      } catch (e: any) {
        out.alt_lookups.nearby_error = e?.message || String(e);
      }
    }
  }

  // 5. Run the real search with the extracted query + coords
  if (out.extracted?.query && out.extracted?.businessLat && out.extracted?.businessLon) {
    try {
      const searchResult = await searchPlaceByText(out.extracted.query, {
        lat: out.extracted.businessLat,
        lon: out.extracted.businessLon,
      });
      out.real_search = searchResult
        ? {
            id: searchResult.id,
            display_name: searchResult.displayName?.text,
            address: searchResult.formattedAddress,
            rating: searchResult.rating,
            review_count: searchResult.userRatingCount,
          }
        : null;
    } catch (e: any) {
      out.real_search_error = e?.message || String(e);
    }

    // Also try without the apostrophe — common Google search workaround
    const noApostrophe = out.extracted.query.replace(/['']/g, "");
    if (noApostrophe !== out.extracted.query) {
      try {
        const altResult = await searchPlaceByText(noApostrophe, {
          lat: out.extracted.businessLat,
          lon: out.extracted.businessLon,
        });
        out.no_apostrophe_search = altResult
          ? {
              query_used: noApostrophe,
              id: altResult.id,
              display_name: altResult.displayName?.text,
              address: altResult.formattedAddress,
            }
          : null;
      } catch (e: any) {
        out.no_apostrophe_search_error = e?.message || String(e);
      }
    }

    // Also try a broader radius (50km) in case 5km was too tight
    try {
      const broaderResult = await searchPlaceByText(out.extracted.query, {
        lat: out.extracted.businessLat,
        lon: out.extracted.businessLon,
        radiusMeters: 50000,
      });
      out.broader_radius_search = broaderResult
        ? {
            radius_meters: 50000,
            id: broaderResult.id,
            display_name: broaderResult.displayName?.text,
            address: broaderResult.formattedAddress,
          }
        : null;
    } catch (e: any) {
      out.broader_radius_error = e?.message || String(e);
    }
  }

  // 6. Run the full resolution end-to-end
  try {
    const fullResult = await resolveBusinessFromUrl(savedUrl);
    out.full_resolve = fullResult
      ? {
          id: fullResult.id,
          display_name: fullResult.displayName?.text,
          address: fullResult.formattedAddress,
        }
      : null;
  } catch (e: any) {
    out.full_resolve_error = e?.message || String(e);
  }

  return NextResponse.json(out);
}
