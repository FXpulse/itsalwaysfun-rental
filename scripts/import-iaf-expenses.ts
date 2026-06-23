/**
 * One-shot importer for Ludmila's "IAF Business expense report .xlsx".
 *
 * Reads the Excel file in OneDrive, maps each row to the business_expenses
 * schema, and inserts via the service-role admin client. Idempotent: rows
 * are hashed (date + account + category + vendor + description + amount +
 * file_offset) and the table has a UNIQUE(tenant_id, source_hash) partial
 * index, so re-running with the same Excel is a no-op.
 *
 * Run locally:
 *   NEXT_PUBLIC_SUPABASE_URL=https://uxghnsadesglqrrvswav.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/import-iaf-expenses.ts
 *
 * The Excel path is hardcoded since this script targets ONE specific file.
 * For generic Excel/CSV import, use the /admin/expenses UI (later phase).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(2);
}

const IAF_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const EXCEL_PATH = String.raw`C:\Users\chemm\OneDrive\Its Always Fun\IAF Business expense report .xlsx`;

// Map the human-friendly ACCOUNT column in the Excel to our DB enum.
function mapAccount(raw: string): "credit_card" | "bank" | "bank_zelle" | "cash" | "check" | "other" {
  const norm = (raw || "").trim().toLowerCase();
  if (norm.includes("credit")) return "credit_card";
  if (norm.includes("zelle")) return "bank_zelle";
  if (norm === "bank") return "bank";
  if (norm.includes("cash")) return "cash";
  if (norm.includes("check")) return "check";
  return "other";
}

// Map the CONCEPT column to one of the seeded category keys.
function mapCategory(raw: string): string {
  const norm = (raw || "").trim().toLowerCase();
  if (norm === "supplies") return "supplies";
  if (norm === "marketing") return "marketing";
  if (norm === "services") return "services";
  if (norm === "transportation") return "transportation";
  if (norm === "insurance") return "insurance";
  if (norm === "payroll") return "payroll";
  if (norm === "travel") return "travel";
  if (norm === "owner capital") return "owner_capital";
  if (norm === "membership" || norm.includes("membership")) return "membership";
  // Empty CONCEPT in the Excel is sometimes used for one-off rows (e.g. AMEX
  // Membership Fee, Inflatable fee warehouse). Bucket as "other" so they
  // still import — admin can re-categorize via the UI later.
  return "other";
}

function toIsoDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    // Local-date ISO, not UTC, to avoid off-by-one days.
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // M/D/YY or M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  // Excel serial number
  const n = Number(s);
  if (Number.isFinite(n) && n > 30000 && n < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(epoch.getTime() + n * 86400000);
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

function toCents(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

interface Row {
  date: string;
  account: ReturnType<typeof mapAccount>;
  category: string;
  vendor_name: string;
  description: string | null;
  amount_cents: number;
  contractor_name: string | null;
  source_hash: string;
}

function detectContractor(category: string, vendor: string | null, details: string | null): string | null {
  if (category !== "payroll") return null;
  // The Excel has VENDOR = "Independent Contractor" and DETAILS = the actual
  // contractor name (Edgar Mendoza, William Andres, etc.).
  const v = (vendor || "").trim().toLowerCase();
  const d = (details || "").trim();
  if (v.includes("independent contractor") && d) return d;
  // Fallback: use whichever non-generic name is present.
  if (d && !d.toLowerCase().includes("contractor")) return d;
  return null;
}

function hashRow(idx: number, row: Omit<Row, "source_hash">): string {
  const h = createHash("sha256");
  h.update(
    [idx, row.date, row.account, row.category, row.vendor_name, row.description || "", row.amount_cents].join("|"),
  );
  return h.digest("hex");
}

async function main() {
  console.log(`[import] Reading ${EXCEL_PATH}`);
  const buf = readFileSync(EXCEL_PATH);
  const wb = XLSX.read(buf, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // Skip the title rows; SheetJS sees headers at 0-indexed row 5 (the
  // sheet layout is: rows 0-3 blank + EXPENSE REPORT title, row 4 blank,
  // row 5 = headers DATE/ACCOUNT/.../TOTAL, row 6+ = data).
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    range: 5,
    defval: null,
    raw: true,
  });
  console.log(`[import] Parsed ${raw.length} raw rows from sheet "${sheetName}"`);

  const rows: Row[] = [];
  let skippedBlank = 0;
  let skippedSubtotal = 0;
  let skippedBadDate = 0;
  let skippedBadAmount = 0;

  raw.forEach((r: any, i) => {
    const date = toIsoDate(r["DATE"]);
    const account = mapAccount(r["ACCOUNT"]);
    const concept = r["CONCEPT"] ?? null;
    const vendor = r["DESCRIPTION"] ? String(r["DESCRIPTION"]).trim() : "";
    const details = r["EXPENSE DETAILS"] ? String(r["EXPENSE DETAILS"]).trim() : null;
    const amount = toCents(r["TOTAL"]);

    // Subtotal rows: no date, no account, no vendor — just a total.
    if (!date && !r["ACCOUNT"] && !r["DESCRIPTION"]) {
      skippedSubtotal++;
      return;
    }
    if (!date) {
      // Could be a fully empty row.
      if (!r["DESCRIPTION"] && !r["TOTAL"]) {
        skippedBlank++;
        return;
      }
      console.warn(`[import] row ${i + 5}: missing/unparseable DATE — skipping (${JSON.stringify(r)})`);
      skippedBadDate++;
      return;
    }
    if (amount == null) {
      console.warn(`[import] row ${i + 5}: missing/unparseable TOTAL — skipping (${JSON.stringify(r)})`);
      skippedBadAmount++;
      return;
    }
    if (!vendor) {
      console.warn(`[import] row ${i + 5}: missing DESCRIPTION (vendor) — skipping`);
      return;
    }
    const category = mapCategory(concept);
    const contractor = detectContractor(category, vendor, details);
    const base = { date, account, category, vendor_name: vendor, description: details, amount_cents: amount, contractor_name: contractor };
    const source_hash = hashRow(i, base);
    rows.push({ ...base, source_hash });
  });

  console.log(`[import] Prepared ${rows.length} insertable rows (skipped: subtotal=${skippedSubtotal} blank=${skippedBlank} bad_date=${skippedBadDate} bad_amount=${skippedBadAmount})`);
  if (rows.length === 0) {
    console.error("[import] Nothing to insert — aborting");
    process.exit(1);
  }

  const total = rows.reduce((s, r) => s + r.amount_cents, 0) / 100;
  console.log(`[import] Total $${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${rows.length} rows`);
  console.log(`[import] Date range: ${rows.reduce((a, r) => (r.date < a ? r.date : a), rows[0].date)} → ${rows.reduce((a, r) => (r.date > a ? r.date : a), rows[0].date)}`);

  const supabase = createClient(URL!, KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // PostgREST onConflict is picky with PARTIAL unique indexes, so instead
  // of UPSERT we query the existing source_hashes for this tenant and
  // filter the payload down to truly-new rows. Slower for huge imports but
  // crystal-clear and works with the partial index.
  const hashes = rows.map((r) => r.source_hash);
  const existing = new Set<string>();
  // Chunk the IN-list to avoid URL length limits.
  for (let i = 0; i < hashes.length; i += 200) {
    const chunk = hashes.slice(i, i + 200);
    const { data: existingRows, error } = await supabase
      .from("business_expenses")
      .select("source_hash")
      .eq("tenant_id", IAF_TENANT_ID)
      .in("source_hash", chunk);
    if (error) {
      console.error("[import] Existing-hash lookup failed:", error.message);
      process.exit(1);
    }
    for (const r of existingRows || []) existing.add((r as any).source_hash);
  }
  console.log(`[import] ${existing.size} row(s) already imported earlier; ${rows.length - existing.size} new`);

  const newRows = rows.filter((r) => !existing.has(r.source_hash));
  if (newRows.length === 0) {
    console.log("[import] ✅ Nothing new to insert — DB already up to date.");
    return;
  }

  const payload = newRows.map((r) => ({
    tenant_id: IAF_TENANT_ID,
    expense_date: r.date,
    account: r.account,
    category: r.category,
    vendor_name: r.vendor_name,
    description: r.description,
    amount_cents: r.amount_cents,
    contractor_name: r.contractor_name,
    source_hash: r.source_hash,
    recorded_by: "import-iaf-expenses.ts",
  }));

  const { data, error } = await supabase
    .from("business_expenses")
    .insert(payload)
    .select("id");

  if (error) {
    console.error("[import] Insert failed:", error.message);
    console.error(error);
    process.exit(1);
  }
  console.log(`[import] ✅ Inserted ${data?.length || 0} new row(s).`);

  // Quick verification readback
  const { count } = await supabase
    .from("business_expenses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", IAF_TENANT_ID);
  console.log(`[import] business_expenses rows on IAF tenant: ${count}`);
}

main().catch((e) => {
  console.error("[import] Failed:", e?.message || e);
  process.exit(1);
});
