/**
 * check-tenant-scope.ts — verifica que lib/tenant/scope.ts no esté desincronizado
 * de la realidad del schema. Corre en CI; falla el PR si:
 *
 *   1. Hay una tabla en la DB con columna `tenant_id` que NO está en
 *      MULTI_TENANT_TABLES ni en INTENTIONALLY_NOT_SCOPED (drift de schema).
 *   2. Hay una entrada en MULTI_TENANT_TABLES para una tabla que ya no existe
 *      en la DB (entrada huérfana).
 *   3. Hay una tabla multi-tenant con RLS DESHABILITADO (defensa en profundidad
 *      rota — sin RLS, un bug en scope.ts es catastrófico).
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL  — el endpoint de la DB
 *   SUPABASE_SERVICE_ROLE_KEY — key con permiso de leer information_schema
 *
 * Local:   npm run check:scope
 * CI:      job scope-check en .github/workflows/ci.yml
 *
 * Cierra OBS-1 del audit multi-tenant 2026-06-10.
 */

import { createClient } from "@supabase/supabase-js";
import { MULTI_TENANT_TABLES, INTENTIONALLY_NOT_SCOPED } from "../lib/tenant/scope";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("[scope-check] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Drift = { type: "missing" | "orphan" | "no_rls" | "no_rls_public"; table: string };

/** Tables in `public` that are intentionally allowed to ship without RLS.
 *  Empty by default — every new entry needs justification in the comment.
 *  We don't have any today (mfa_recovery_codes had RLS added on 2026-06-23). */
const RLS_OPTIONAL_PUBLIC_TABLES = new Set<string>([
  // example:
  // "marketing_features_flags", // public read-only, no PII, intentional
]);

async function getAllPublicTablesRls(): Promise<Array<{ table_name: string; rls_enabled: boolean; policy_count: number }>> {
  // Mirror of getLiveTenantTables but covers EVERY public table — used to
  // enforce "ship-with-RLS-on" hygiene catched once with Supabase advisor.
  const { data, error } = await supabase.rpc("list_public_tables_rls_status");
  if (error) {
    console.warn(
      "[scope-check] RPC list_public_tables_rls_status not present — skipping the public-RLS check.",
    );
    console.warn("    Apply migration: supabase/migrations/20260623130000_list_public_tables_rls_rpc.sql");
    return [];
  }
  return (data as Array<{ table_name: string; rls_enabled: boolean; policy_count: number }>) || [];
}

async function getLiveTenantTables(): Promise<Array<{ table_name: string; rls_enabled: boolean }>> {
  // Trick: information_schema no se expone via PostgREST por default.
  // Usamos una RPC custom. Si no existe la RPC, queda como warning.
  const { data, error } = await supabase.rpc("list_tenant_id_tables");
  if (error) {
    // Fallback: probar pg_catalog directo via la función _pg_check (común en Supabase)
    console.warn(
      "[scope-check] RPC list_tenant_id_tables no existe. Crear esta función en la DB:",
    );
    console.warn(`
      CREATE OR REPLACE FUNCTION public.list_tenant_id_tables()
      RETURNS TABLE(table_name text, rls_enabled bool)
      LANGUAGE sql SECURITY DEFINER AS $$
        SELECT
          c.table_name::text,
          (SELECT pt.rowsecurity FROM pg_tables pt
           WHERE pt.schemaname='public' AND pt.tablename = c.table_name) AS rls_enabled
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'tenant_id'
        ORDER BY c.table_name;
      $$;
      REVOKE ALL ON FUNCTION public.list_tenant_id_tables() FROM PUBLIC;
      -- Solo service_role la puede llamar.
    `);
    throw new Error("Missing RPC list_tenant_id_tables");
  }
  return (data as Array<{ table_name: string; rls_enabled: boolean }>) || [];
}

async function main() {
  const liveRows = await getLiveTenantTables();
  const liveTables = new Set<string>(liveRows.map((r) => r.table_name));
  const rlsByTable = new Map<string, boolean>(liveRows.map((r) => [r.table_name, r.rls_enabled]));

  const drift: Drift[] = [];

  // Check #1: tablas live con tenant_id que no están listadas en ningún set
  liveTables.forEach((t) => {
    if (!MULTI_TENANT_TABLES.has(t) && !INTENTIONALLY_NOT_SCOPED.has(t)) {
      drift.push({ type: "missing", table: t });
    }
  });

  // Check #2: entradas en MULTI_TENANT_TABLES que apuntan a tablas que ya no existen
  MULTI_TENANT_TABLES.forEach((t) => {
    if (!liveTables.has(t)) {
      drift.push({ type: "orphan", table: t });
    }
  });

  // Check #3: tablas multi-tenant con RLS deshabilitado
  MULTI_TENANT_TABLES.forEach((t) => {
    if (liveTables.has(t) && rlsByTable.get(t) === false) {
      drift.push({ type: "no_rls", table: t });
    }
  });

  // Check #4: cualquier tabla public con RLS off (no solo multi-tenant).
  // Catched once by Supabase's own advisor on 2026-06-23 for
  // mfa_recovery_codes — adding it here makes the bar future-proof.
  const allPublic = await getAllPublicTablesRls();
  for (const row of allPublic) {
    if (row.rls_enabled) continue;
    if (RLS_OPTIONAL_PUBLIC_TABLES.has(row.table_name)) continue;
    // Don't double-report — multi-tenant ones already flagged under no_rls.
    if (MULTI_TENANT_TABLES.has(row.table_name)) continue;
    drift.push({ type: "no_rls_public", table: row.table_name });
  }

  // Reporte
  if (drift.length === 0) {
    console.log(
      `[scope-check] OK — ${MULTI_TENANT_TABLES.size} multi-tenant tables, ${INTENTIONALLY_NOT_SCOPED.size} intentional exclusions, all in sync.`,
    );
    process.exit(0);
  }

  console.error("[scope-check] DRIFT DETECTED:");
  const missing = drift.filter((d) => d.type === "missing");
  const orphan = drift.filter((d) => d.type === "orphan");
  const noRls = drift.filter((d) => d.type === "no_rls");
  const noRlsPublic = drift.filter((d) => d.type === "no_rls_public");

  if (missing.length) {
    console.error(`\n  Tables in DB with tenant_id but NOT in MULTI_TENANT_TABLES (${missing.length}):`);
    for (const d of missing) console.error(`    - ${d.table}`);
    console.error(
      "    Fix: add to MULTI_TENANT_TABLES in lib/tenant/scope.ts, or list explicitly in INTENTIONALLY_NOT_SCOPED with a reason.",
    );
  }

  if (orphan.length) {
    console.error(`\n  Entries in MULTI_TENANT_TABLES that don't exist in DB (${orphan.length}):`);
    for (const d of orphan) console.error(`    - ${d.table}`);
    console.error("    Fix: remove from MULTI_TENANT_TABLES (table was dropped or renamed).");
  }

  if (noRls.length) {
    console.error(`\n  Multi-tenant tables with RLS disabled (${noRls.length}):`);
    for (const d of noRls) console.error(`    - ${d.table}`);
    console.error(
      "    Fix: ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY + add appropriate policies.",
    );
    console.error(
      "    Without RLS, scope.ts is the ONLY guard against cross-tenant leaks — that's not defense in depth.",
    );
  }

  if (noRlsPublic.length) {
    console.error(`\n  Public tables (non-multi-tenant) with RLS disabled (${noRlsPublic.length}):`);
    for (const d of noRlsPublic) console.error(`    - ${d.table}`);
    console.error(
      "    Fix: ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY in a migration.",
    );
    console.error(
      "    If a table is intentionally world-readable (rare), allowlist it in",
    );
    console.error(
      "      RLS_OPTIONAL_PUBLIC_TABLES inside scripts/check-tenant-scope.ts with a justifying comment.",
    );
    console.error(
      "    Supabase's own advisor flags these too; this script catches them BEFORE deploy.",
    );
  }

  process.exit(1);
}

main().catch((e) => {
  console.error("[scope-check] Failed:", e?.message || e);
  process.exit(2);
});
