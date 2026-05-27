// Server-side helpers to read the current tenant from request headers.
// Middleware sets `x-tenant-id` and `x-tenant-slug` headers on every
// request; server components, API routes, and server actions read them
// via these helpers.

import { headers } from "next/headers";
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from "./resolve";

export interface CurrentTenant {
  id: string;
  slug: string;
  /** "custom_domain" | "subdomain" | "default" | "marketing" */
  resolved_via: string;
  /** True when this is the SaaS landing page, not a specific tenant */
  isMarketing: boolean;
}

/** Returns the resolved tenant from request headers (set by middleware).
 *  Falls back to the default tenant (IAF) if headers are missing — keeps
 *  legacy code working during the multi-tenant rollout. */
export function getCurrentTenant(): CurrentTenant {
  let h: Headers;
  try {
    h = headers();
  } catch {
    // Outside request context (e.g. during build) — return default
    return {
      id: DEFAULT_TENANT_ID,
      slug: DEFAULT_TENANT_SLUG,
      resolved_via: "default",
      isMarketing: false,
    };
  }

  const id = h.get("x-tenant-id") || DEFAULT_TENANT_ID;
  const slug = h.get("x-tenant-slug") || DEFAULT_TENANT_SLUG;
  const resolved_via = h.get("x-tenant-via") || "default";

  return {
    id,
    slug,
    resolved_via,
    isMarketing: id === "__marketing__",
  };
}

/** Convenience: just the tenant_id string. */
export function getCurrentTenantId(): string {
  return getCurrentTenant().id;
}
