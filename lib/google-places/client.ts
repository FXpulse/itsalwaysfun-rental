// Google Places API (NEW) client — read-only public data.
//
// Unlike Business Profile API (which requires OAuth + ownership), Places API
// is a simple API-key call that returns public info about any business
// indexed by Google. No tenant OAuth needed; one platform-level API key
// (GOOGLE_PLACES_API_KEY env var) serves all tenants.
//
// Tenant pastes their GBP URL in /admin/site → we extract a place_id or
// CID → Places API returns the place details including up to 5 most-recent
// reviews + aggregate rating. Cron syncs daily.
//
// Setup steps (operator does this ONCE):
//   1. Google Cloud Console → APIs & Services → Library → enable
//      "Places API (New)" — separate from the classic Places API.
//   2. APIs & Services → Credentials → Create API key (or reuse one already
//      used by prospector — same key works).
//   3. Restrict key by API: select "Places API (New)" only (defense).
//   4. Vercel env var: GOOGLE_PLACES_API_KEY=<your key>

const PLACES_API = "https://places.googleapis.com/v1";

export function isPlacesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

/** Extract a Google Maps place ID or CID from various GBP URL formats:
 *   - https://maps.google.com/?cid=<digits>
 *   - https://www.google.com/maps/place/<name>/@.../data=...3m1!4b1...
 *   - https://g.page/<slug>
 *   - https://maps.app.goo.gl/<shortcode>
 *   - https://www.google.com/maps?q=place_id:<id>
 *
 *  Some of these (g.page, maps.app.goo.gl) are short URLs — we follow the
 *  redirect to get the canonical URL, then parse.
 */
export async function extractPlaceIdentifier(url: string): Promise<{ placeId?: string; cid?: string; query?: string } | null> {
  if (!url) return null;
  let finalUrl = url.trim();

  // Follow short URL redirects (g.page, maps.app.goo.gl) once
  if (/g\.page|maps\.app\.goo\.gl/.test(finalUrl)) {
    try {
      const res = await fetch(finalUrl, { method: "HEAD", redirect: "follow" });
      finalUrl = res.url;
    } catch {
      // ignore, parse what we have
    }
  }

  // 1. ?cid=<digits>
  const cidMatch = finalUrl.match(/[?&]cid=(\d+)/);
  if (cidMatch) return { cid: cidMatch[1] };

  // 2. place_id:XYZ
  const placeIdMatch = finalUrl.match(/place_id:([A-Za-z0-9_-]+)/);
  if (placeIdMatch) return { placeId: placeIdMatch[1] };

  // 3. URL path /place/<name>/@... — extract name + maybe coords for a text search
  const nameMatch = finalUrl.match(/\/place\/([^/]+)\/?/);
  if (nameMatch) {
    const name = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
    return { query: name };
  }

  return null;
}

interface PlaceDetails {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews?: Array<{
    name?: string;
    rating?: number;
    text?: { text?: string };
    authorAttribution?: { displayName?: string; photoUri?: string };
    publishTime?: string;
    relativePublishTimeDescription?: string;
  }>;
  websiteUri?: string;
  primaryType?: string;
  googleMapsUri?: string;
}

const PLACE_DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "reviews",
  "websiteUri",
  "primaryType",
  "googleMapsUri",
].join(",");

/** Fetch full place details by place_id. Returns up to 5 reviews + ratings.
 *  Costs ~$0.017 per call at retail; first ~14k/mo free with $200 credit. */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!isPlacesConfigured()) return null;
  const url = `${PLACES_API}/places/${placeId}?languageCode=en`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELDS,
    },
  });
  if (!res.ok) {
    console.error("[Places API] details failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  return res.json();
}

/** Text search — used when we only have a business name (parsed from URL).
 *  Returns the most likely matching place. */
export async function searchPlaceByText(query: string): Promise<PlaceDetails | null> {
  if (!isPlacesConfigured() || !query) return null;
  const res = await fetch(`${PLACES_API}/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": `places.${PLACE_DETAILS_FIELDS.split(",").join(",places.")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) {
    console.error("[Places API] text search failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data.places?.[0] || null;
}

/** CID lookup via Place ID Finder isn't a direct Places API call — we use
 *  a text search of "google maps cid:<n>" which Google resolves. As a
 *  fallback the user can just paste a place_id directly. */
export async function resolveCid(cid: string): Promise<PlaceDetails | null> {
  return searchPlaceByText(`google cid:${cid}`);
}

/** Top-level helper: take whatever the tenant pasted and return place details.
 *  Returns null if API isn't configured or URL is unparseable. */
export async function resolveBusinessFromUrl(url: string): Promise<PlaceDetails | null> {
  if (!isPlacesConfigured()) return null;
  const parsed = await extractPlaceIdentifier(url);
  if (!parsed) return null;
  if (parsed.placeId) return getPlaceDetails(parsed.placeId);
  if (parsed.cid) return resolveCid(parsed.cid);
  if (parsed.query) return searchPlaceByText(parsed.query);
  return null;
}
