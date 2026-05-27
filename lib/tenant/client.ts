// Tenant-scoped Supabase client factories.
//
// ─── WHEN TO USE WHICH ──────────────────────────────────────────────────
//
// 1. createTenantUserClient() — anon key + user's JWT.
//    Use for: admin pages that should be tenant-scoped automatically via RLS.
//    Behavior: queries auto-filter by tenant_id via the user's user_roles row.
//    Cross-tenant access is REJECTED at the DB layer (RLS policy).
//
// 2. createTenantAdminClient() — service role + X-Tenant-Id header.
//    Use for: server actions / webhooks that need elevated permissions
//    (e.g. creating auth users, bulk operations, public site rendering)
//    BUT must respect tenant boundaries.
//    Behavior: service role bypasses RLS, but the header lets the
//    application code (or future RLS via current_setting) know which
//    tenant is being acted on. CALLER MUST still add .eq("tenant_id", ...)
//    on every query — the header alone does NOT enforce isolation
//    when using service role.
//
// 3. createAdminClient() (existing) — service role, no tenant context.
//    Use for: superadmin operations that span tenants (billing, tenant
//    onboarding, SaaS-wide reports).
//
// ─── MIGRATION PATTERN ──────────────────────────────────────────────────
//
// BEFORE (single-tenant):
//   const supabase = createAdminClient();
//   const { data } = await supabase.from("bookings").select("*");
//
// AFTER (multi-tenant safe):
//   const supabase = createTenantAdminClient();
//   const { data } = await supabase
//     .from("bookings")
//     .select("*")
//     .eq("tenant_id", getCurrentTenantId());
//
// OR (using user JWT path — RLS does the filtering):
//   const supabase = createTenantUserClient();
//   const { data } = await supabase.from("bookings").select("*");
//   // tenant filter is applied automatically by RLS

import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentTenantId } from "./server";

/** User-scoped client (anon + JWT). RLS auto-enforces tenant isolation
 *  based on the user's user_roles row. */
export function createTenantUserClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component without a response context
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {}
        },
      },
    },
  );
}

/** Service-role client with tenant context attached as a header.
 *  IMPORTANT: service role bypasses RLS. Callers MUST still add
 *  .eq("tenant_id", getCurrentTenantId()) on every multi-tenant query.
 *  The header is informational — used for audit logging and future
 *  policy hooks. */
export function createTenantAdminClient() {
  const tenantId = getCurrentTenantId();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          "X-Tenant-Id": tenantId,
        },
      },
    },
  );
}
