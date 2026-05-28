// Proxy wrapper that auto-injects tenant_id into Supabase queries on
// multi-tenant tables. Used by createAdminClient when called inside a
// request context (so cron jobs / build time get unwrapped, cross-tenant
// client; HTTP requests get scoped client).
//
// This lets the existing 100+ files using createAdminClient become
// tenant-safe WITHOUT touching each one.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TENANT_ID } from "./resolve";

// Tables that have a tenant_id column (must match Chunk 1A migration)
const MULTI_TENANT_TABLES = new Set([
  // Booking flow
  "bookings",
  "booking_expenses",
  "booking_damages",
  "booking_proofs",
  "booking_waivers",
  "booking_extensions",
  "coi_requests",
  "dispatch_routes",
  "dispatch_stops",
  // Customer-facing
  "customer_profiles",
  "gift_cards",
  "gift_card_redemptions",
  "gift_card_purchases",
  "quotes",
  "payout_requests",
  "contact_messages",
  "contact_message_replies",
  "customer_reviews",
  "loyalty_transactions",
  // Catalog
  "products",
  "product_inventory_requirements",
  "product_images",
  "categories",
  "setup_surfaces",
  "inventory_items",
  "inventory_units",
  "inventory_categories",
  "vehicles",
  "trailers",
  "packages",
  "coupons",
  // Accounting + admin
  "overhead_costs",
  "overhead_categories",
  "booking_expense_categories",
  "driver_tax_profiles",
  "admin_audit_log",
  // Settings + content
  "site_settings",
  "email_templates",
  "home_banners",
  "faqs",
  // Auth
  "user_roles",
]);

function isMultiTenantTable(name: string): boolean {
  return MULTI_TENANT_TABLES.has(name);
}

function injectTenantInto<T extends Record<string, any> | Record<string, any>[]>(
  data: T,
  tenantId: string,
): T {
  if (Array.isArray(data)) {
    return data.map((r) => ({ tenant_id: tenantId, ...r })) as T;
  }
  return { tenant_id: tenantId, ...data } as T;
}

/** Wrap a Supabase client so all multi-tenant queries are auto-scoped to
 *  the given tenant. Returns the SAME client object (mutated `from`) — no
 *  performance penalty per query. */
export function scopeToTenant(
  client: SupabaseClient,
  tenantId: string,
): SupabaseClient {
  const originalFrom = client.from.bind(client);

  // Replace .from with a wrapping version
  (client as any).from = (table: string) => {
    const queryBuilder = originalFrom(table);
    if (!isMultiTenantTable(table)) {
      return queryBuilder;
    }

    // Patch select/update/delete/insert/upsert on this query builder
    const origSelect = queryBuilder.select.bind(queryBuilder);
    (queryBuilder as any).select = (...args: any[]) => {
      const fb = origSelect(...args);
      return fb.eq("tenant_id", tenantId);
    };

    const origUpdate = queryBuilder.update.bind(queryBuilder);
    (queryBuilder as any).update = (data: any, ...rest: any[]) => {
      const fb = origUpdate(data, ...rest);
      return fb.eq("tenant_id", tenantId);
    };

    const origDelete = queryBuilder.delete.bind(queryBuilder);
    (queryBuilder as any).delete = (...args: any[]) => {
      const fb = origDelete(...args);
      return fb.eq("tenant_id", tenantId);
    };

    const origInsert = queryBuilder.insert.bind(queryBuilder);
    (queryBuilder as any).insert = (data: any, ...rest: any[]) => {
      return origInsert(injectTenantInto(data, tenantId), ...rest);
    };

    const origUpsert = queryBuilder.upsert.bind(queryBuilder);
    (queryBuilder as any).upsert = (data: any, ...rest: any[]) => {
      return origUpsert(injectTenantInto(data, tenantId), ...rest);
    };

    return queryBuilder;
  };

  return client;
}

/** Best-effort: read current tenant_id from request headers. Returns null
 *  outside request context (cron jobs, build time, scripts). */
export function tryGetTenantIdFromHeaders(): string | null {
  // Lazy import to avoid breaking server-only modules at build time
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers } = require("next/headers");
    const h = headers();
    const id = h.get("x-tenant-id");
    if (id && id !== "__marketing__") return id;
    return null;
  } catch {
    return null;
  }
}

export { DEFAULT_TENANT_ID };
