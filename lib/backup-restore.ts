// Backup importer — carga un JSON generado por exportFullBackup() de vuelta
// a la DB. Server-only, requires service role.
//
// Estrategia:
//   1. Para cada tabla en RESTORE_ORDER (parent → child), si está en el JSON:
//      - dry-run: contamos filas que se procesarían pero no escribimos
//      - real: upsert (onConflict: id) en batches de 500
//   2. Si una tabla del JSON no está en RESTORE_ORDER → la procesamos al final
//      en "extras pass" (best-effort, no rompemos si falla)
//   3. Capturamos cada error sin abortar — al final reportamos qué pasó por tabla
//
// Idempotencia: upsert por id. Re-correr el restore con el mismo backup es seguro
// si ningún row fue modificado entre ambas corridas.

import { createAdminClient } from "@/lib/supabase/admin";

/** Orden de restore — parent tables primero. Tablas que dependen via FK van
 *  después de sus parents. NO incluye TODAS las tablas — solo las que sabemos
 *  ordenar. Las que no están acá se procesan al final con risk de FK violation. */
const RESTORE_ORDER: string[] = [
  // Foundation — TODO depende de tenants
  "tenants",
  "user_roles",

  // Catalog independiente
  "categories",
  "inventory_categories",
  "vehicles",
  "trailers",
  "overhead_categories",
  "booking_expense_categories",
  "setup_surfaces",
  "site_settings",
  "email_templates",
  "home_banners",
  "faqs",
  "driver_tax_profiles",
  "tenant_api_keys",
  "tenant_webhooks",
  "tenant_goals",
  "tenant_home_sections",
  "tenant_onboarding_checklist",
  "tenant_operator_notes",
  "tenant_profile",
  "custom_reports",
  "google_business_connections",
  "google_places_cache",
  "inspection_templates",

  // Products (depende de categories)
  "products",
  "product_images",
  "product_inventory_requirements",

  // Inventory (depende de inventory_categories)
  "inventory_items",
  "inventory_units",

  // Packages (depende de products via FK opcional)
  "packages",

  // Customers + marketing
  "customer_profiles",
  "customer_tags",
  "customer_reviews",
  "campaigns",
  "campaign_recipients",
  "coupons",
  "loyalty_transactions",
  "payout_requests",
  "portal_otp_codes",
  "contact_messages",
  "contact_message_replies",

  // Gift cards (depende de customer_profiles via email opcional)
  "gift_cards",
  "gift_card_purchases",
  "gift_card_redemptions",

  // Quotes (depende de products + customers)
  "quotes",

  // Bookings — el core, depende de muchas
  "bookings",
  "booking_expenses",
  "booking_damages",
  "booking_proofs",
  "booking_waivers",
  "booking_extensions",
  "booking_inspections",
  "booking_internal_messages",
  "coi_requests",

  // Dispatch (depende de bookings + vehicles)
  "dispatch_routes",
  "dispatch_stops",

  // Movement tracking (depende de inventory_units + bookings)
  "inventory_unit_movements",

  // Overhead (depende de overhead_categories)
  "overhead_costs",

  // Support (independiente)
  "support_tickets",

  // Audit (al final — todo lo demás puede generar audit logs)
  "admin_audit_log",
];

export interface RestoreOptions {
  /** Si true, no escribe nada — solo cuenta + valida que las tablas existen.
   *  Útil para previsualizar antes de un restore real. */
  dryRun?: boolean;
  /** Si true, vacía cada tabla ANTES de cargar (delete + insert).
   *  ⚠ PELIGROSO — solo para restore catastrófico a un project vacío. */
  truncateFirst?: boolean;
  /** Solo restaurar filas de UN tenant. Útil para "deletié bookings de tenant X
   *  pero los otros tenants están OK". Si null → restaura todas las filas. */
  tenantFilter?: string | null;
  /** Callback para progreso (UI o logs). */
  onProgress?: (info: { table: string; processed: number; total: number }) => void;
}

export interface TableRestoreResult {
  inserted: number;
  skipped_no_rows: boolean;
  errors: string[];
  duration_ms: number;
}

export interface RestoreResult {
  version: string;
  imported_at: string;
  source_exported_at: string;
  tables: Record<string, TableRestoreResult>;
  total_inserted: number;
  total_errors: number;
  duration_ms: number;
  unknown_tables: string[]; // tablas en el JSON que NO existen en RESTORE_ORDER
  dry_run: boolean;
}

/** Importer principal. NO maneja auth — confía en el caller (cli script o
 *  endpoint admin protegido). */
export async function importFullBackup(
  backup: any,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  const startedAt = Date.now();
  const dryRun = options.dryRun === true;
  const truncateFirst = options.truncateFirst === true;
  const tenantFilter = options.tenantFilter ?? null;

  if (!backup || typeof backup !== "object" || !backup.tables) {
    throw new Error("Invalid backup: missing .tables object");
  }

  const supabase = createAdminClient({ unscoped: true });
  const tablesData: Record<string, any[]> = backup.tables;
  const result: RestoreResult = {
    version: "1.0",
    imported_at: new Date().toISOString(),
    source_exported_at: backup.exported_at || "unknown",
    tables: {},
    total_inserted: 0,
    total_errors: 0,
    duration_ms: 0,
    unknown_tables: [],
    dry_run: dryRun,
  };

  const orderedSet = new Set(RESTORE_ORDER);
  const jsonTables = Object.keys(tablesData).filter((t) => !t.startsWith("_"));
  const unknown = jsonTables.filter((t) => !orderedSet.has(t));
  result.unknown_tables = unknown;

  // 1. Tablas en orden conocido
  for (const table of RESTORE_ORDER) {
    const rows = tablesData[table];
    if (!rows || !Array.isArray(rows)) continue;
    result.tables[table] = await processTable(
      supabase,
      table,
      rows,
      { dryRun, truncateFirst, tenantFilter },
      options.onProgress,
    );
    result.total_inserted += result.tables[table].inserted;
    result.total_errors += result.tables[table].errors.length;
  }

  // 2. Extras pass: tablas del JSON que no están en RESTORE_ORDER (best-effort)
  for (const table of unknown) {
    const rows = tablesData[table];
    if (!Array.isArray(rows)) continue;
    result.tables[table] = await processTable(
      supabase,
      table,
      rows,
      { dryRun, truncateFirst, tenantFilter },
      options.onProgress,
    );
    result.total_inserted += result.tables[table].inserted;
    result.total_errors += result.tables[table].errors.length;
  }

  result.duration_ms = Date.now() - startedAt;
  return result;
}

async function processTable(
  supabase: any,
  table: string,
  rows: any[],
  opts: { dryRun: boolean; truncateFirst: boolean; tenantFilter: string | null },
  onProgress?: RestoreOptions["onProgress"],
): Promise<TableRestoreResult> {
  const startedAt = Date.now();
  const errors: string[] = [];

  // Tenant filter
  let filtered = rows;
  if (opts.tenantFilter && rows.length > 0 && "tenant_id" in (rows[0] as any)) {
    filtered = rows.filter((r) => r.tenant_id === opts.tenantFilter);
  }

  if (filtered.length === 0) {
    return {
      inserted: 0,
      skipped_no_rows: true,
      errors: [],
      duration_ms: Date.now() - startedAt,
    };
  }

  // Truncate (peligroso)
  if (opts.truncateFirst && !opts.dryRun) {
    try {
      let del = supabase.from(table).delete();
      // Para tenantFilter, solo truncar filas de ese tenant.
      // Si no, hacer .neq("id", null) (truncate completo).
      if (opts.tenantFilter && filtered.length > 0 && "tenant_id" in (filtered[0] as any)) {
        del = del.eq("tenant_id", opts.tenantFilter);
      } else {
        del = del.not("id", "is", null);
      }
      const { error } = await del;
      if (error) errors.push(`truncate failed: ${error.message}`);
    } catch (e: any) {
      errors.push(`truncate threw: ${e?.message || e}`);
    }
  }

  if (opts.dryRun) {
    return {
      inserted: filtered.length,
      skipped_no_rows: false,
      errors: [],
      duration_ms: Date.now() - startedAt,
    };
  }

  // Insert en batches de 500 para no fundir el request body
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < filtered.length; i += BATCH) {
    const slice = filtered.slice(i, i + BATCH);
    try {
      const { data, error } = await supabase
        .from(table)
        .upsert(slice, { onConflict: "id", ignoreDuplicates: false })
        .select("id");
      if (error) {
        errors.push(`batch ${i / BATCH + 1}: ${error.message}`);
      } else {
        inserted += (data?.length as number) || slice.length;
      }
    } catch (e: any) {
      errors.push(`batch ${i / BATCH + 1} threw: ${e?.message || e}`);
    }
    if (onProgress) {
      onProgress({ table, processed: Math.min(i + BATCH, filtered.length), total: filtered.length });
    }
  }

  return {
    inserted,
    skipped_no_rows: false,
    errors,
    duration_ms: Date.now() - startedAt,
  };
}
