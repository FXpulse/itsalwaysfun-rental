/**
 * import-backup.ts — CLI wrapper para lib/backup-restore.importFullBackup().
 *
 * Usage:
 *   npx tsx scripts/import-backup.ts <path-to-backup.json> [--dry-run] [--tenant=<uuid>] [--truncate-first]
 *
 * Examples:
 *   # Preview qué pasaría sin escribir
 *   npx tsx scripts/import-backup.ts ./latest-backup.json --dry-run
 *
 *   # Restore completo a un Supabase project nuevo (debe estar vacío)
 *   NEXT_PUBLIC_SUPABASE_URL=https://NEW-PROJECT.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=NEW-KEY \
 *   npx tsx scripts/import-backup.ts ./latest-backup.json
 *
 *   # Restore solo de un tenant específico
 *   npx tsx scripts/import-backup.ts ./backup.json --tenant=rEODC2aob2D7SPwtVAEk
 *
 *   # ⚠ PELIGROSO: vaciar tablas antes de cargar
 *   npx tsx scripts/import-backup.ts ./backup.json --truncate-first
 */

import { readFileSync, existsSync } from "fs";
import { importFullBackup } from "../lib/backup-restore";

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const truncateFirst = args.includes("--truncate-first");
  const tenantArg = args.find((a) => a.startsWith("--tenant="));
  const tenantFilter = tenantArg ? tenantArg.split("=")[1] : null;

  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-backup.ts <path-to-backup.json> [--dry-run] [--tenant=<uuid>] [--truncate-first]");
    process.exit(2);
  }
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(2);
  }

  console.log(`[import-backup] Reading ${filePath}...`);
  let backup: any;
  try {
    backup = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (e: any) {
    console.error(`Failed to parse JSON: ${e?.message || e}`);
    process.exit(2);
  }

  console.log(`[import-backup] Backup exported at: ${backup.exported_at || "unknown"}`);
  console.log(`[import-backup] Backup version: ${backup.version || "unknown"}`);
  console.log(`[import-backup] Tables in backup: ${Object.keys(backup.tables || {}).length}`);
  if (dryRun) console.log(`[import-backup] DRY RUN — no writes will happen`);
  if (truncateFirst) console.log(`[import-backup] ⚠ TRUNCATE FIRST — tables will be emptied before loading`);
  if (tenantFilter) console.log(`[import-backup] Tenant filter: ${tenantFilter}`);
  console.log("");

  // Confirmation gate para operaciones peligrosas (truncate sin dry-run)
  if (truncateFirst && !dryRun && !process.env.I_KNOW_WHAT_IM_DOING) {
    console.error("");
    console.error("⛔ --truncate-first is destructive. Set I_KNOW_WHAT_IM_DOING=1 to proceed.");
    console.error("   Recommended: run with --dry-run first to preview.");
    process.exit(3);
  }

  const result = await importFullBackup(backup, {
    dryRun,
    truncateFirst,
    tenantFilter,
    onProgress: ({ table, processed, total }) => {
      process.stdout.write(`\r[${table}] ${processed}/${total}    `);
    },
  });
  process.stdout.write("\n\n");

  // Reporte
  console.log("=== Summary ===");
  console.log(`Duration: ${result.duration_ms}ms`);
  console.log(`Total inserted: ${result.total_inserted}`);
  console.log(`Total errors:   ${result.total_errors}`);
  console.log(`Unknown tables (skipped order, processed last): ${result.unknown_tables.length}`);
  if (result.unknown_tables.length > 0) {
    for (const t of result.unknown_tables) console.log(`  - ${t}`);
  }
  console.log("");

  console.log("=== By table ===");
  const sortedTables = Object.keys(result.tables).sort();
  for (const t of sortedTables) {
    const r = result.tables[t];
    if (r.skipped_no_rows) continue; // hide silent skips
    const errIndicator = r.errors.length > 0 ? ` [${r.errors.length} errors]` : "";
    console.log(`  ${t.padEnd(35)} inserted=${r.inserted.toString().padStart(6)}${errIndicator}`);
    for (const e of r.errors.slice(0, 3)) {
      console.log(`      ${e}`);
    }
    if (r.errors.length > 3) console.log(`      ... and ${r.errors.length - 3} more errors`);
  }

  if (result.total_errors > 0) {
    console.error("");
    console.error(`⚠ Restore completed with ${result.total_errors} errors. Review output above.`);
    process.exit(1);
  }

  console.log("");
  console.log(dryRun ? "✓ Dry-run completed cleanly." : "✓ Restore completed successfully.");
}

main().catch((e) => {
  console.error("[import-backup] Failed:", e?.message || e);
  process.exit(2);
});
