// Tenant-aware DB helpers — server-only.
//
// USAGE PATTERN (for new code):
//
//   import { getCurrentTenantId, withTenant } from "@/lib/tenant/db";
//
//   // Reads — filter explicitly:
//   const { data } = await supabase
//     .from("bookings")
//     .select("*")
//     .eq("tenant_id", getCurrentTenantId());
//
//   // Inserts — wrap the row to inject tenant_id:
//   await supabase.from("bookings").insert(withTenant({ ...bookingData }));
//
//   // Updates / deletes — always include tenant_id in the filter:
//   await supabase
//     .from("bookings")
//     .update({ status: "paid" })
//     .eq("id", bookingId)
//     .eq("tenant_id", getCurrentTenantId());
//
// Once Chunk 1D ships, RLS will REQUIRE this filtering. Code that
// doesn't pass tenant context will return zero rows or error.

import { getCurrentTenant, getCurrentTenantId } from "./server";

export { getCurrentTenant, getCurrentTenantId };

/** Inject tenant_id into a row before insert. Returns a new object —
 *  doesn't mutate the input. */
export function withTenant<T extends Record<string, any>>(
  row: T,
): T & { tenant_id: string } {
  return { ...row, tenant_id: getCurrentTenantId() };
}

/** Inject tenant_id into many rows (for batch inserts). */
export function withTenantMany<T extends Record<string, any>>(
  rows: T[],
): Array<T & { tenant_id: string }> {
  const tenantId = getCurrentTenantId();
  return rows.map((r) => ({ ...r, tenant_id: tenantId }));
}

/** Defense-in-depth: assert a fetched record belongs to the current tenant.
 *  Throws if not. Use after any single-row fetch (.single(), .maybeSingle())
 *  that you want bulletproof against accidental cross-tenant reads while
 *  RLS isn't yet enforced. */
export function assertTenantBoundary<T extends { tenant_id?: string }>(
  record: T | null,
): T | null {
  if (!record) return null;
  const expected = getCurrentTenantId();
  if (record.tenant_id && record.tenant_id !== expected) {
    throw new Error(
      `Cross-tenant access denied: record.tenant_id=${record.tenant_id} but current=${expected}`,
    );
  }
  return record;
}
