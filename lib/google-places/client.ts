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
export interface ExtractedIdentifier {
  placeId?: string;
  cid?: string;
  query?: string;
  /** Actual business coordinates (from !3d!4d in long URL) — most precise. */
  businessLat?: number;
  businessLon?: number;
  /** Viewport center coordinates from @lat,lon — fallback location bias. */
  viewportLat?: number;
  viewportLon?: number;
}

export async function extractPlaceIdentifier(url: string): Promise<ExtractedIdentifier | null> {
  if (!url) return null;
  let finalUrl = url.trim();

  // Follow short URL redirects (g.page, maps.app.goo.gl).
  // Google often doesn't issue an HTTP redirect for these — they serve an
  // HTML page that does JavaScript-based navigation. So we fetch the body,
  // look for the canonical Maps URL embedded in meta tags + scripts, and
  // use that as finalUrl.
  if (/g\.page|maps\.app\.goo\.gl/.test(finalUrl)) {
    try {
      const res = await fetch(finalUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      // If fetch followed an HTTP redirect, res.url is the destination
      if (res.url && res.url !== finalUrl) {
        finalUrl = res.url;
        console.log("[Places] HTTP redirect", url, "→", finalUrl);
      } else {
        // No HTTP redirect — parse the HTML for the canonical URL
        const body = await res.text();
        const extracted = extractCanonicalMapsUrlFromHtml(body);
        if (extracted) {
          finalUrl = extracted;
          console.log("[Places] HTML extracted canonical", url, "→", finalUrl);
        } else {
          console.warn("[Places] no redirect, no canonical found in body", url);
        }
      }
    } catch (e: any) {
      console.error("[Places] redirect follow failed", url, e?.message);
    }
  }

  // place_id:XYZ — most explicit, no ambiguity
  const placeIdMatch = finalUrl.match(/place_id:([A-Za-z0-9_-]+)/);
  if (placeIdMatch) return { placeId: placeIdMatch[1] };

  const out: ExtractedIdentifier = {};

  // ?cid=<digits>
  const cidMatch = finalUrl.match(/[?&]cid=(\d+)/);
  if (cidMatch) out.cid = cidMatch[1];

  // Long URL coordinates:
  //   @<lat>,<lon>,<zoom>   = viewport center where map was framed
  //   !3d<lat>!4d<lon>      = actual business pin (much more precise)
  // Business coords are inside the data segment after !8m2!3d!4d.
  const viewportMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+),/);
  if (viewportMatch) {
    out.viewportLat = parseFloat(viewportMatch[1]);
    out.viewportLon = parseFloat(viewportMatch[2]);
  }
  const businessCoordsMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (businessCoordsMatch) {
    out.businessLat = parseFloat(businessCoordsMatch[1]);
    out.businessLon = parseFloat(businessCoordsMatch[2]);
  }

  // /place/<name>/...
  const nameMatch = finalUrl.match(/\/place\/([^/]+)\/?/);
  if (nameMatch) {
    out.query = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
  }

  if (out.placeId || out.cid || out.query) {
    console.log("[Places] extracted", { ...out, sourceUrl: url, finalUrl });
    return out;
  }
  console.warn("[Places] could not extract anything from URL", { url, finalUrl });
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
    const errText = await res.text().catch(() => "");
    console.error("[Places API] getPlaceDetails failed", res.status, errText.slice(0, 500));
    return null;
  }
  return res.json();
}

/** Text search — used when we only have a business name (parsed from URL).
 *  Returns the most likely matching place. When `locationBias` is set, the
 *  Places API narrows results to a 5km radius around it — critical when the
 *  business name is generic (multiple businesses share "It's Always Fun"). */
export async function searchPlaceByText(
  query: string,
  locationBias?: { lat: number; lon: number; radiusMeters?: number },
): Promise<PlaceDetails | null> {
  if (!isPlacesConfigured() || !query) return null;

  const body: any = { textQuery: query, maxResultCount: 1 };
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.lat, longitude: locationBias.lon },
        radius: locationBias.radiusMeters || 5000,
      },
    };
  }

  console.log("[Places API] searchText", { query, locationBias });
  const res = await fetch(`${PLACES_API}/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": `places.${PLACE_DETAILS_FIELDS.split(",").join(",places.")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[Places API] searchText failed", res.status, errText.slice(0, 500));
    return null;
  }
  const data = await res.json();
  if (!data.places || data.places.length === 0) {
    console.warn("[Places API] searchText returned no results", { query, locationBias });
  } else {
    const first = data.places[0];
    console.log("[Places API] searchText match", {
      query,
      matched: first.displayName?.text,
      address: first.formattedAddress,
      place_id: first.id,
    });
  }
  return data.places?.[0] || null;
}

/** CID lookup via Place ID Finder isn't a direct Places API call — we use
 *  a text search of "google maps cid:<n>" which Google resolves. As a
 *  fallback the user can just paste a place_id directly. */
export async function resolveCid(
  cid: string,
  locationBias?: { lat: number; lon: number },
): Promise<PlaceDetails | null> {
  return searchPlaceByText(`google cid:${cid}`, locationBias);
}

/** Top-level helper: take whatever the tenant pasted and return place details.
 *  Returns null if API isn't configured or URL is unparseable. Uses business
 *  coordinates from the URL (if present) as a location bias on text searches
 *  — eliminates ambiguity when a name matches multiple businesses globally. */
export async function resolveBusinessFromUrl(url: string): Promise<PlaceDetails | null> {
  if (!isPlacesConfigured()) return null;
  const parsed = await extractPlaceIdentifier(url);
  if (!parsed) return null;

  // place_id is unambiguous — use directly
  if (parsed.placeId) return getPlaceDetails(parsed.placeId);

  // Build a location bias: prefer business coordinates (precise pin),
  // fall back to viewport center if pin coords aren't in the URL.
  const bias =
    parsed.businessLat && parsed.businessLon
      ? { lat: parsed.businessLat, lon: parsed.businessLon }
      : parsed.viewportLat && parsed.viewportLon
      ? { lat: parsed.viewportLat, lon: parsed.viewportLon }
      : undefined;

  if (parsed.cid) return resolveCid(parsed.cid, bias);
  if (parsed.query) return searchPlaceByText(parsed.query, bias);
  return null;
}

/** Extract the canonical Google Maps URL from a short-URL response body.
 *  Google's `maps.app.goo.gl` and `g.page` short URLs return an HTML page
 *  with the destination encoded in several places. We try, in order:
 *
 *  1. <meta http-equiv="refresh" content="0; URL=https://www.google.com/maps/...">
 *  2. <link rel="canonical" href="https://www.google.com/maps/...">
 *  3. <meta property="og:url" content="https://www.google.com/maps/...">
 *  4. window.APP_INITIALIZATION_STATE = [...] — long JSON containing the URL
 *  5. Any plain text /maps/place/...@<coords>... URL in the body
 */
function extractCanonicalMapsUrlFromHtml(html: string): string | null {
  if (!html) return null;

  // 1. meta refresh
  const refresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'>]+)["']/i);
  if (refresh && /maps/.test(refresh[1])) {
    return decodeHtml(refresh[1]);
  }

  // 2. canonical link
  const canonical = html.match(/<link[^>]+rel=["']?canonical["']?[^>]+href=["']([^"']+)["']/i);
  if (canonical && /\/maps\//.test(canonical[1])) {
    return decodeHtml(canonical[1]);
  }

  // 3. og:url
  const ogUrl = html.match(/<meta[^>]+property=["']?og:url["']?[^>]+content=["']([^"']+)["']/i);
  if (ogUrl && /\/maps\//.test(ogUrl[1])) {
    return decodeHtml(ogUrl[1]);
  }

  // 4. Plain text /place/<name>/@<coords>... anywhere in the body
  const placeUrl = html.match(/https?:\/\/(?:www\.)?google\.com\/maps\/place\/[^"'<>\s]+/);
  if (placeUrl) {
    return decodeHtml(placeUrl[0]);
  }

  // 5. Any !3d!4d coordinate string — we can rebuild a usable URL
  const dataUrl = html.match(/https?:\/\/(?:www\.)?google\.com\/maps[^"'<>\s]*!3d[-\d.]+!4d[-\d.]+[^"'<>\s]*/);
  if (dataUrl) {
    return decodeHtml(dataUrl[0]);
  }

  return null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
