// Proxy wrapper that auto-injects tenant_id into Supabase queries on
// multi-tenant tables. Used by createAdminClient when called inside a
// request context (so cron jobs / build time get unwrapped, cross-tenant
// client; HTTP requests get scoped client).
//
// This lets the existing 100+ files using createAdminClient become
// tenant-safe WITHOUT touching each one.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TENANT_ID } from "./resolve";

// Tables that have a tenant_id column AND should be auto-scoped by this
// proxy.
//
// Listing a table here when the column doesn't exist breaks every query:
//   .select() adds .eq("tenant_id", X) → returns 0 rows
//   .insert() injects tenant_id field → PostgREST rejects unknown field
//
// Some child tables (e.g. dispatch_stops, booking_expenses) do have
// tenant_id NOT NULL — added by multi_tenant_foundation.sql for fast
// filtering. Those MUST be listed here so inserts get tenant_id injected.
//
// If you add a new top-level multi-tenant table, list it here.
// If you add a child table, check the schema: if it has tenant_id NOT
// NULL, list it here too — otherwise leave it off.
export const MULTI_TENANT_TABLES = new Set([
  // Top-level entities with tenant_id
  "bookings",
  "dispatch_routes",
  "customer_profiles",
  "gift_cards",
  "gift_card_purchases",
  "quotes",
  "payout_requests",
  "contact_messages",
  "customer_reviews",
  "loyalty_transactions",
  "gift_card_redemptions",
  "products",
  "categories",
  "setup_surfaces",
  "inventory_items",
  "inventory_categories",
  "vehicles",
  "trailers",
  "packages",
  "coupons",
  "overhead_costs",
  "overhead_categories",
  "driver_tax_profiles",
  "admin_audit_log",
  "site_settings",
  "email_templates",
  "home_banners",
  "faqs",
  "user_roles",
  "customer_tags",
  "campaigns",
  "tenant_api_keys",
  "tenant_webhooks",
  "custom_reports",
  "google_business_connections",
  "tenant_goals",
  "tenant_home_sections",
  "tenant_onboarding_checklist",
  "tenant_operator_notes",
  // Child table with explicit tenant_id NOT NULL (per multi_tenant_foundation.sql).
  // MUST be scoped — inserts otherwise throw NOT NULL violation.
  "dispatch_stops",
  // ERPNext-inspired inspection workflow (2026-06-16)
  "inspection_templates",
  "booking_inspections",
  // tenant_id added 2026-06-19 (security audit M9) — now NOT NULL, auto-inject on insert.
  "blocked_dates",
  // General business expenses (transactional) — 2026-06-23
  "business_expenses",
  "business_expense_categories",
  // ERPNext-inspired asset movement state machine (2026-06-16)
  "inventory_unit_movements",
  // Team chat thread per booking (2026-06-16)
  "booking_internal_messages",
  // Drift detectado por check-tenant-scope.ts CI 2026-06-16 — tablas que
  // tenían tenant_id pero faltaban en este set:
  "google_places_cache",        // per-tenant Google Places API result cache
  "portal_otp_codes",           // OTP codes para customer portal login
  "support_tickets",            // soporte interno por tenant
  "tenant_profile",             // profile/metadata del tenant
  // In-app beta feedback widget submissions (2026-06-17)
  "beta_feedback",
  // Driver skill/availability profile used by AI route optimizer (2026-06-18)
  "driver_schedule_profiles",
  // Photo + signature capture at delivery/pickup. `tenant_id` NOT NULL in
  // DB since multi_tenant_foundation.sql; the default was later dropped by
  // drop_default_tenant_id.sql, so inserts from proof-actions.ts must be
  // scoped via the proxy or they hit a NOT NULL violation (2026-07-01).
  "booking_proofs",
  // Same story as booking_proofs — these all got tenant_id NOT NULL in
  // multi_tenant_foundation.sql and lost their default in
  // drop_default_tenant_id.sql. Any insert must be auto-scoped or it
  // throws a NOT NULL violation. Moved out of INTENTIONALLY_NOT_SCOPED
  // together on 2026-07-01 to prevent the same class of bug.
  "booking_damages",
  "booking_waivers",
  "booking_extensions",
  "coi_requests",
  "booking_expense_categories",
  "booking_expenses",
]);

/** Tablas que SÍ tienen columna `tenant_id` (o conceptualmente son por-tenant)
 *  pero que NO queremos auto-scopear via el proxy. Razones:
 *   - Tablas hijas que heredan tenancy via FK al padre (no necesitan inyección
 *     directa). Si las metés en MULTI_TENANT_TABLES, el proxy intenta inyectar
 *     `tenant_id` y PostgREST tira "unknown field" porque la columna no existe.
 *   - Tablas nuevas que todavía no se usan desde código (placeholder schemas).
 *  El check-tenant-scope.ts CI step usa esta allowlist para distinguir
 *  "drift real" de "exclusión intencional". */
export const INTENTIONALLY_NOT_SCOPED = new Set([
  // NOTE 2026-07-01: booking_proofs, booking_damages, booking_waivers,
  // booking_extensions, coi_requests, booking_expense_categories, and
  // booking_expenses all moved OUT of this set into MULTI_TENANT_TABLES.
  // Reason: the schema shipped tenant_id NOT NULL DEFAULT '11111111...'
  // via multi_tenant_foundation.sql; that default was later dropped by
  // drop_default_tenant_id.sql (correct for multi-tenant safety), which
  // then made every insert throw a NOT NULL violation until the proxy
  // was configured to auto-inject.
  // Hijas de products (tenancy via product_id FK)
  "product_inventory_requirements",
  "product_images",
  // Hijas de inventory_items (tenancy via inventory_item_id FK)
  "inventory_units",
  // Hijas de contact_messages / campaigns
  "contact_message_replies",
  "campaign_recipients",
  // No usage yet — agregar a MULTI_TENANT_TABLES cuando aparezca el primer
  // call site que inserte/actualice estas tablas
  "google_business_reviews",
  "google_business_posts",
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
    // Lazy require: ESLint Next config doesn't ship @typescript-eslint plugin
    // for the var-requires rule, so we use a generic disable.
    // eslint-disable-next-line
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
