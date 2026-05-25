"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { parseCsv } from "@/lib/csv";

interface BulkResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

function toBool(s: string | undefined, defaultValue = false): boolean {
  if (!s) return defaultValue;
  const lower = s.toLowerCase().trim();
  return ["true", "yes", "1", "y"].includes(lower);
}

function toInt(s: string | undefined, defaultValue = 0): number {
  if (!s) return defaultValue;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

function toFloat(s: string | undefined, defaultValue = 0): number {
  if (!s) return defaultValue;
  const n = parseFloat(s);
  return Number.isNaN(n) ? defaultValue : n;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────
export async function bulkUploadProducts(csvText: string): Promise<BulkResult> {
  await requireAdmin();
  const parsed = parseCsv(csvText);
  if (parsed.errors.length > 0) return { inserted: 0, skipped: 0, errors: parsed.errors };

  const result: BulkResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    try {
      if (!r.name) {
        result.skipped++;
        result.errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const slug = r.slug || slugify(r.name);
      const row = {
        name: r.name,
        slug,
        category: r.category || "Uncategorized",
        description: r.description || null,
        price_per_day: Math.round(toFloat(r.price_per_day_dollars) * 100),
        cost_cents: Math.round(toFloat(r.cost_dollars) * 100),
        stock: toInt(r.stock, 1),
        image_url: r.image_url || null,
        is_active: toBool(r.is_active, true),
        is_addon: toBool(r.is_addon, false),
        weekend_price_per_day: r.weekend_price_per_day_dollars
          ? Math.round(toFloat(r.weekend_price_per_day_dollars) * 100)
          : null,
        setup_area: r.setup_area || null,
        actual_size: r.actual_size || null,
        outlets_required: toInt(r.outlets_required, 1),
        age_group: r.age_group || null,
      };
      const { error } = await supabase.from("products").insert(row);
      if (error) {
        result.skipped++;
        result.errors.push(`Row ${i + 2} (${r.name}): ${error.message}`);
      } else {
        result.inserted++;
      }
    } catch (e: any) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: ${e.message}`);
    }
  }

  revalidatePath("/admin/products");
  return result;
}

// ─── INVENTORY ────────────────────────────────────────────────────────
export async function bulkUploadInventory(csvText: string): Promise<BulkResult> {
  await requireAdmin();
  const parsed = parseCsv(csvText);
  if (parsed.errors.length > 0) return { inserted: 0, skipped: 0, errors: parsed.errors };

  const result: BulkResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    try {
      if (!r.name) {
        result.skipped++;
        result.errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const row = {
        name: r.name,
        category: r.category || "other",
        description: r.description || null,
        quantity_owned: toInt(r.quantity_owned, 1),
        quantity_in_use: toInt(r.quantity_in_use, 0),
        location: r.location || null,
        condition: ["good", "needs_repair", "broken", "retired"].includes(r.condition)
          ? r.condition
          : "good",
        purchase_date: r.purchase_date || null,
        purchase_cost_cents: Math.round(toFloat(r.purchase_cost_dollars) * 100),
        notes: r.notes || null,
        is_active: toBool(r.is_active, true),
      };
      const { error } = await supabase.from("inventory_items").insert(row);
      if (error) {
        result.skipped++;
        result.errors.push(`Row ${i + 2} (${r.name}): ${error.message}`);
      } else {
        result.inserted++;
      }
    } catch (e: any) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: ${e.message}`);
    }
  }

  revalidatePath("/admin/inventory");
  return result;
}

// ─── CATEGORIES ───────────────────────────────────────────────────────
export async function bulkUploadCategories(csvText: string): Promise<BulkResult> {
  await requireAdmin();
  const parsed = parseCsv(csvText);
  if (parsed.errors.length > 0) return { inserted: 0, skipped: 0, errors: parsed.errors };

  const result: BulkResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    try {
      if (!r.name) {
        result.skipped++;
        result.errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const row = {
        name: r.name,
        slug: r.slug || slugify(r.name),
        description: r.description || null,
        image_url: r.image_url || null,
        display_order: toInt(r.display_order, 0),
        is_active: toBool(r.is_active, true),
      };
      const { error } = await supabase.from("categories").insert(row);
      if (error) {
        result.skipped++;
        result.errors.push(`Row ${i + 2} (${r.name}): ${error.message}`);
      } else {
        result.inserted++;
      }
    } catch (e: any) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: ${e.message}`);
    }
  }

  revalidatePath("/admin/categories");
  return result;
}

// ─── VEHICLES ─────────────────────────────────────────────────────────
export async function bulkUploadVehicles(csvText: string): Promise<BulkResult> {
  await requireAdmin();
  const parsed = parseCsv(csvText);
  if (parsed.errors.length > 0) return { inserted: 0, skipped: 0, errors: parsed.errors };

  const result: BulkResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    try {
      if (!r.name) {
        result.skipped++;
        result.errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const row = {
        name: r.name,
        vehicle_type: ["truck", "van", "pickup", "other"].includes(r.vehicle_type)
          ? r.vehicle_type
          : "truck",
        requires_trailer: toBool(r.requires_trailer, true),
        capacity_notes: r.capacity_notes || null,
        license_tag: r.license_tag ? r.license_tag.trim().toUpperCase() : null,
        vin: r.vin ? r.vin.trim().toUpperCase() : null,
        is_active: toBool(r.is_active, true),
      };
      const { error } = await supabase.from("vehicles").insert(row);
      if (error) {
        result.skipped++;
        result.errors.push(`Row ${i + 2} (${r.name}): ${error.message}`);
      } else {
        result.inserted++;
      }
    } catch (e: any) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: ${e.message}`);
    }
  }

  revalidatePath("/admin/fleet");
  return result;
}

// ─── TRAILERS ─────────────────────────────────────────────────────────
export async function bulkUploadTrailers(csvText: string): Promise<BulkResult> {
  await requireAdmin();
  const parsed = parseCsv(csvText);
  if (parsed.errors.length > 0) return { inserted: 0, skipped: 0, errors: parsed.errors };

  const result: BulkResult = { inserted: 0, skipped: 0, errors: [] };
  const supabase = createAdminClient();

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    try {
      if (!r.name) {
        result.skipped++;
        result.errors.push(`Row ${i + 2}: missing name`);
        continue;
      }
      const row = {
        name: r.name,
        capacity_notes: r.capacity_notes || null,
        license_tag: r.license_tag ? r.license_tag.trim().toUpperCase() : null,
        vin: r.vin ? r.vin.trim().toUpperCase() : null,
        is_active: toBool(r.is_active, true),
      };
      const { error } = await supabase.from("trailers").insert(row);
      if (error) {
        result.skipped++;
        result.errors.push(`Row ${i + 2} (${r.name}): ${error.message}`);
      } else {
        result.inserted++;
      }
    } catch (e: any) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: ${e.message}`);
    }
  }

  revalidatePath("/admin/fleet");
  return result;
}
