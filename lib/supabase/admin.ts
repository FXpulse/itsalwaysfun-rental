// Admin client using SERVICE_ROLE_KEY. Server-side ONLY.
//
// MULTI-TENANT BEHAVIOR:
//   - When called inside a request context (via Next.js HTTP request),
//     the returned client is AUTO-SCOPED to the current tenant. All
//     queries on multi-tenant tables auto-filter by tenant_id.
//   - When called outside a request context (cron jobs, build time,
//     scripts), the client is cross-tenant — no tenant filter is applied.
//   - To explicitly bypass scoping inside a request (e.g. superadmin
//     operations that span tenants), pass `{ unscoped: true }`.
//
// This wrap means existing code using createAdminClient() becomes
// tenant-safe automatically when called from HTTP handlers, without
// touching every file individually.

import { createClient } from "@supabase/supabase-js";
import { scopeToTenant, tryGetTenantIdFromHeaders } from "@/lib/tenant/scope";

export interface AdminClientOptions {
  /** Skip tenant scoping — returns a raw cross-tenant client.
   *  Use for: cron jobs that process all tenants, superadmin tools,
   *  Stripe webhooks that resolve tenant from metadata. */
  unscoped?: boolean;
}

export function createAdminClient(opts: AdminClientOptions = {}) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // Skip scoping if explicitly opted out
  if (opts.unscoped) return client;

  // Try to grab tenant from request headers (middleware sets these)
  const tenantId = tryGetTenantIdFromHeaders();
  if (!tenantId) {
    // Outside request context (cron, build) — return cross-tenant client
    return client;
  }

  return scopeToTenant(client, tenantId);
}
