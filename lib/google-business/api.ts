// High-level GBP API operations: list locations, fetch reviews, reply, post.
// Auto-refreshes access tokens via the connection's refresh_token.

import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "./client";

const GBP_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_REVIEWS_API = "https://mybusiness.googleapis.com/v4"; // Note: legacy v4 — Google may consolidate
const GBP_POSTS_API = "https://mybusiness.googleapis.com/v4";

export interface GbpConnection {
  id: string;
  tenant_id: string;
  google_email: string | null;
  location_id: string | null;
  location_name: string | null;
  location_address: string | null;
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
}

/** Fetch the active GBP connection for the current tenant. Returns null if
 *  not connected. */
export async function getConnection(tenantId: string): Promise<GbpConnection | null> {
  const supabase = createAdminClient({ unscoped: true });
  const { data } = await supabase
    .from("google_business_connections")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as GbpConnection) || null;
}

/** Get a fresh access_token. Refreshes from refresh_token if expired (with a
 *  60s safety margin). Persists the new token back to the DB. */
async function getValidAccessToken(conn: GbpConnection): Promise<string> {
  const expiresAt = new Date(conn.access_token_expires_at).getTime();
  const stillValid = expiresAt - Date.now() > 60_000;
  if (stillValid) return conn.access_token;

  // Refresh
  const refreshed = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("google_business_connections")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: newExpiresAt,
      // Refresh tokens usually don't rotate but if Google returns a new one, store it
      refresh_token: refreshed.refresh_token || conn.refresh_token,
    })
    .eq("id", conn.id);

  return refreshed.access_token;
}

async function gbpGet<T = any>(conn: GbpConnection, path: string, base = GBP_API): Promise<T> {
  const accessToken = await getValidAccessToken(conn);
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GBP API GET ${path} failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  return res.json();
}

async function gbpPut<T = any>(conn: GbpConnection, path: string, body: any, base = GBP_REVIEWS_API): Promise<T> {
  const accessToken = await getValidAccessToken(conn);
  const res = await fetch(`${base}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GBP API PUT ${path} failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  return res.json();
}

async function gbpPost<T = any>(conn: GbpConnection, path: string, body: any, base = GBP_POSTS_API): Promise<T> {
  const accessToken = await getValidAccessToken(conn);
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GBP API POST ${path} failed (${res.status}): ${errText.slice(0, 300)}`);
  }
  return res.json();
}

/** List the user's accounts (typically returns 1 personal + 0-N business). */
export async function listAccounts(conn: GbpConnection): Promise<Array<{ name: string; accountName?: string }>> {
  const data = await gbpGet<{ accounts: Array<any> }>(
    conn,
    "/accounts",
    "https://mybusinessaccountmanagement.googleapis.com/v1",
  );
  return data.accounts || [];
}

/** List the locations for a given account (e.g. "accounts/<id>"). */
export async function listLocations(
  conn: GbpConnection,
  accountName: string,
): Promise<Array<{ name: string; title?: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string } }>> {
  const data = await gbpGet<{ locations: Array<any> }>(
    conn,
    `/${accountName}/locations?readMask=name,title,storefrontAddress`,
  );
  return data.locations || [];
}

/** Pull all reviews for the connected location. GBP returns paginated. */
export async function fetchReviews(conn: GbpConnection): Promise<Array<{
  name: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string; // GBP returns "FIVE", "FOUR" etc.
  comment?: string;
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}>> {
  if (!conn.location_id) throw new Error("No location selected");
  const reviews: Array<any> = [];
  let pageToken: string | undefined;

  for (let i = 0; i < 20; i++) { // cap at 20 pages = 2000 reviews
    const path = `/${conn.location_id}/reviews?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const data = await gbpGet<{ reviews?: any[]; nextPageToken?: string }>(conn, path, GBP_REVIEWS_API);
    if (data.reviews) reviews.push(...data.reviews);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return reviews;
}

/** Reply to a review. GBP allows one reply per review (it overwrites). */
export async function replyToReview(
  conn: GbpConnection,
  reviewName: string,
  comment: string,
): Promise<{ comment: string; updateTime: string }> {
  return gbpPut(conn, `/${reviewName}/reply`, { comment }, GBP_REVIEWS_API);
}

/** Delete a reply (revert to no reply). */
export async function deleteReply(conn: GbpConnection, reviewName: string): Promise<void> {
  const accessToken = await getValidAccessToken(conn);
  const res = await fetch(`${GBP_REVIEWS_API}/${reviewName}/reply`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete reply failed (${res.status})`);
  }
}

/** Create a local post (announcement/offer/event/alert) on the location. */
export async function createLocalPost(
  conn: GbpConnection,
  input: {
    summary: string;
    topicType: "STANDARD" | "OFFER" | "EVENT" | "ALERT";
    callToAction?: { actionType: string; url: string };
    media?: Array<{ mediaFormat: "PHOTO"; sourceUrl: string }>;
  },
): Promise<{ name: string }> {
  if (!conn.location_id) throw new Error("No location selected");
  return gbpPost(conn, `/${conn.location_id}/localPosts`, input);
}

/** Convert GBP "FIVE" rating to integer 5. */
export function starRatingToInt(s: string | undefined): number | null {
  const map: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  };
  return s ? (map[s] ?? null) : null;
}
