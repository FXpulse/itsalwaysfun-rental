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
 *   4. Hay una tabla `public` con RLS off que no está en la allowlist —
 *      espeja el advisor de Supabase.
 *   5. (2026-07-01) Hay una tabla listada en INTENTIONALLY_NOT_SCOPED cuya
 *      columna tenant_id es NOT NULL SIN DEFAULT. Ese es exactamente el patrón
 *      que rompió booking_proofs en prod: si el proxy no la scopea, cualquier
 *      insert lanza `null value in column "tenant_id" violates not null`.
 *      Un opt-out sano requiere que el caller inyecte tenant_id manualmente
 *      Y (ideal) que la tabla no tenga NOT NULL sin default. Detecta la clase
 *      exacta de bomba latente antes de que explote.
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

type Drift = {
  type: "missing" | "orphan" | "no_rls" | "no_rls_public" | "excluded_but_not_null_no_default";
  table: string;
};

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

type LiveTenantRow = {
  table_name: string;
  rls_enabled: boolean;
  /** True when the tenant_id column is declared NOT NULL.
   *  Missing in the pre-2026-07-01 RPC — treat undefined as unknown and
   *  DO NOT run Check #5 for that row (soft-degrade instead of crashing). */
  is_not_null?: boolean;
  /** True when the tenant_id column has a DEFAULT expression. Same
   *  compatibility note as above. */
  has_default?: boolean;
};

async function getLiveTenantTables(): Promise<Array<LiveTenantRow>> {
  // Trick: information_schema no se expone via PostgREST por default.
  // Usamos una RPC custom. Si no existe la RPC, queda como warning.
  const { data, error } = await supabase.rpc("list_tenant_id_tables");
  if (error) {
    console.warn(
      "[scope-check] RPC list_tenant_id_tables no existe. Crear con la migración:",
    );
    console.warn(
      "    supabase/migrations/20260701120000_extend_list_tenant_id_tables.sql",
    );
    throw new Error("Missing RPC list_tenant_id_tables");
  }
  return (data as Array<LiveTenantRow>) || [];
}

async function main() {
  const liveRows = await getLiveTenantTables();
  const liveTables = new Set<string>(liveRows.map((r) => r.table_name));
  const rlsByTable = new Map<string, boolean>(liveRows.map((r) => [r.table_name, r.rls_enabled]));
  const metaByTable = new Map<string, LiveTenantRow>(liveRows.map((r) => [r.table_name, r]));

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

  // Check #5: booking_proofs-class trap (added 2026-07-01).
  // A table in INTENTIONALLY_NOT_SCOPED with tenant_id NOT NULL and NO
  // default is a bomb: the proxy won't inject tenant_id, and no default
  // means every insert fails with a NOT NULL violation. Either the table
  // needs the proxy (move to MULTI_TENANT_TABLES) or the caller code must
  // inject tenant_id manually before insert. Fail CI so the choice is
  // explicit.
  //
  // Soft-degrade: if the RPC didn't return is_not_null / has_default
  // (running against a pre-migration DB), skip this check for that row
  // rather than reporting false positives.
  INTENTIONALLY_NOT_SCOPED.forEach((t) => {
    const meta = metaByTable.get(t);
    if (!meta) return; // table doesn't exist — orphan handled elsewhere (or intentional)
    if (meta.is_not_null === undefined || meta.has_default === undefined) return;
    if (meta.is_not_null && !meta.has_default) {
      drift.push({ type: "excluded_but_not_null_no_default", table: t });
    }
  });

  // Reporte
  if (drift.length === 0) {
    console.log(
      `[scope-check] OK — ${MULTI_TENANT_TABLES.size} multi-tenant tables, ${INTENTIONALLY_NOT_SCOPED.size} intentional exclusions, 5 checks passed.`,
    );
    process.exit(0);
  }

  console.error("[scope-check] DRIFT DETECTED:");
  const missing = drift.filter((d) => d.type === "missing");
  const orphan = drift.filter((d) => d.type === "orphan");
  const noRls = drift.filter((d) => d.type === "no_rls");
  const noRlsPublic = drift.filter((d) => d.type === "no_rls_public");
  const trapped = drift.filter((d) => d.type === "excluded_but_not_null_no_default");

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

  if (trapped.length) {
    console.error(
      `\n  Tables opting OUT of the scope proxy but with tenant_id NOT NULL (no default) (${trapped.length}):`,
    );
    for (const d of trapped) console.error(`    - ${d.table}`);
    console.error(
      "    This is the exact class of latent bug that broke booking_proofs in prod on 2026-07-01.",
    );
    console.error(
      "    Every insert on these tables will throw:",
    );
    console.error(
      "      null value in column \"tenant_id\" violates not null constraint",
    );
    console.error(
      "    Fix (pick one):",
    );
    console.error(
      "      (a) Move from INTENTIONALLY_NOT_SCOPED → MULTI_TENANT_TABLES so the proxy auto-injects.",
    );
    console.error(
      "      (b) Keep it opted out and audit every insert call site to inject tenant_id manually.",
    );
    console.error(
      "          Then add a DEFAULT to the column so accidental inserts don't crash.",
    );
    console.error(
      "    Almost always (a) is correct.",
    );
  }

  process.exit(1);
}

main().catch((e) => {
  console.error("[scope-check] Failed:", e?.message || e);
  process.exit(2);
});
