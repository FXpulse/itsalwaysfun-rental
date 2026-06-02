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

  return NextResponse.json(out);
}
