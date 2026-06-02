// Google Business Profile (GBP) API client for RentalFlow.
//
// Tenants connect their Google account via OAuth → we store access + refresh
// tokens scoped to their tenant_id → use them to read reviews + post updates.
//
// Setup steps (operator does these ONCE, platform-wide):
//   1. Google Cloud Console → New Project (rentalflow-platform)
//   2. APIs & Services → Enable: "Business Profile API", "My Business Account
//      Management API"
//   3. APIs & Services → OAuth consent screen → External, fill all required
//      fields. List scopes: business.manage. Submit for production approval.
//   4. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web app):
//      - Authorized JavaScript origins:  https://getrentalflow.com,
//                                       https://*.getrentalflow.com,
//                                       https://itsalwaysfun.net,
//                                       https://itsalwaysfun.com
//      - Authorized redirect URIs:
//        https://itsalwaysfun.net/api/google-business/auth/callback
//        https://itsalwaysfun.com/api/google-business/auth/callback
//        https://*.getrentalflow.com/api/google-business/auth/callback (add per custom domain)
//   5. Vercel env vars:
//        GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET
//   6. Submit OAuth consent screen for verification — this is the 1-2 week
//      wait. Until approved, only test users can connect.

const OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
];

export function isGoogleBusinessConfigured(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

/** Build the URL we redirect the user to for OAuth consent.
 *  state should encode tenant_id + a nonce so the callback can verify. */
export function buildOAuthUrl(params: { state: string; redirectUri: string }): string {
  const u = new URL(OAUTH_BASE);
  u.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", params.state);
  return u.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

/** Exchange an authorization code for tokens. Called from the callback route. */
export async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    code: params.code,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }
  return res.json();
}

/** Refresh an expired access_token using the long-lived refresh_token. */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }
  return res.json();
}

/** Revoke a token (called when user disconnects). Best-effort. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // Silent — we're disconnecting anyway
  }
}

/** Parse the id_token JWT payload to extract the user's email. No verification
 *  — we trust Google's TLS for ID. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
    return decoded.email || null;
  } catch {
    return null;
  }
}
