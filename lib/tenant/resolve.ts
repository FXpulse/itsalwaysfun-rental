// Resolve which tenant a request belongs to, based on hostname.
//
// Logic:
//   - If hostname matches a tenant's custom_domain → that tenant
//   - Else if hostname is "<slug>.getrentalflow.com" → look up by slug
//   - Else if hostname is "getrentalflow.com" or "www.getrentalflow.com"
//       → SaaS marketing page (no tenant)
//   - Else fall back to the default tenant (IAF) for dev / preview /
//       unknown hosts. This keeps localhost + Vercel preview URLs working.

import { createClient } from "@supabase/supabase-js";

// Hardcoded UUID seeded by multi_tenant_foundation.sql
export const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
export const DEFAULT_TENANT_SLUG = "itsalwaysfun";

// SaaS apex domains (treated as "no tenant" — show marketing page)
const SAAS_APEX_HOSTS = new Set([
  "getrentalflow.com",
  "www.getrentalflow.com",
]);

// The base SaaS domain — anything matching *.SAAS_BASE is a tenant subdomain
const SAAS_BASE = "getrentalflow.com";

export interface ResolvedTenant {
  id: string;
  slug: string;
  business_name: string;
  custom_domain: string | null;
  branding: Record<string, any>;
  /** "custom_domain" | "subdomain" | "default" | "marketing" */
  resolved_via: "custom_domain" | "subdomain" | "default" | "marketing";
}

const MARKETING_SENTINEL: ResolvedTenant = {
  id: "__marketing__",
  slug: "__marketing__",
  business_name: "RentalFlow",
  custom_domain: null,
  branding: {},
  resolved_via: "marketing",
};

// In-memory cache (per Edge runtime instance) — 60s TTL to avoid DB hit per request
const cache = new Map<string, { tenant: ResolvedTenant; expires: number }>();
const CACHE_TTL_MS = 60_000;

function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** Resolve tenant from a raw hostname (e.g. "bouncedreams.getrentalflow.com"). */
export async function resolveTenantByHostname(
  hostname: string,
): Promise<ResolvedTenant> {
  const host = hostname.toLowerCase().split(":")[0]; // strip port

  // Check cache
  const cached = cache.get(host);
  if (cached && cached.expires > Date.now()) {
    return cached.tenant;
  }

  // SaaS apex (marketing page)
  if (SAAS_APEX_HOSTS.has(host)) {
    cache.set(host, { tenant: MARKETING_SENTINEL, expires: Date.now() + CACHE_TTL_MS });
    return MARKETING_SENTINEL;
  }

  const supabase = getSupabaseAnon();

  // 1. Custom domain lookup (e.g. itsalwaysfun.net)
  if (!host.endsWith(SAAS_BASE)) {
    const { data } = await supabase
      .from("tenants")
      .select("id, slug, business_name, custom_domain, branding")
      .eq("custom_domain", host)
      .maybeSingle();
    if (data) {
      const t: ResolvedTenant = { ...data, resolved_via: "custom_domain" };
      cache.set(host, { tenant: t, expires: Date.now() + CACHE_TTL_MS });
      return t;
    }
  }

  // 2. Subdomain on the SaaS base — extract slug
  if (host.endsWith("." + SAAS_BASE)) {
    const slug = host.slice(0, -("." + SAAS_BASE).length);
    if (slug && slug !== "www") {
      const { data } = await supabase
        .from("tenants")
        .select("id, slug, business_name, custom_domain, branding")
        .eq("slug", slug)
        .maybeSingle();
      if (data) {
        const t: ResolvedTenant = { ...data, resolved_via: "subdomain" };
        cache.set(host, { tenant: t, expires: Date.now() + CACHE_TTL_MS });
        return t;
      }
    }
  }

  // 3. Fallback to default tenant (IAF) — covers localhost, vercel.app
  //    preview URLs, and any unknown host
  const { data: defaultTenant } = await supabase
    .from("tenants")
    .select("id, slug, business_name, custom_domain, branding")
    .eq("id", DEFAULT_TENANT_ID)
    .maybeSingle();
  const t: ResolvedTenant = defaultTenant
    ? { ...defaultTenant, resolved_via: "default" }
    : {
        id: DEFAULT_TENANT_ID,
        slug: DEFAULT_TENANT_SLUG,
        business_name: "It's Always Fun, LLC",
        custom_domain: null,
        branding: {},
        resolved_via: "default",
      };
  cache.set(host, { tenant: t, expires: Date.now() + CACHE_TTL_MS });
  return t;
}

/** Synchronous helper for tests that don't have DB access. */
export function isMarketingHost(host: string): boolean {
  return SAAS_APEX_HOSTS.has(host.toLowerCase().split(":")[0]);
}

export function extractSubdomainSlug(host: string): string | null {
  const h = host.toLowerCase().split(":")[0];
  if (!h.endsWith("." + SAAS_BASE)) return null;
  const slug = h.slice(0, -("." + SAAS_BASE).length);
  if (!slug || slug === "www") return null;
  return slug;
}
