"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const BulkSchema = z.object({
  item_id: z.string().uuid(),
  count: z.number().int().min(1).max(200),
  prefix: z.string().min(2).max(10).regex(/^[A-Z0-9-]+$/i, "Letters/digits/dash only"),
});

/** Bulk-generate N units for an item using the supplied prefix. */
export async function bulkGenerateUnits(formData: FormData) {
  await requireAdmin();
  const parsed = BulkSchema.safeParse({
    item_id: String(formData.get("item_id") || ""),
    count: parseInt(String(formData.get("count") || "0"), 10),
    prefix: String(formData.get("prefix") || "").trim().toUpperCase(),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("generate_inventory_units", {
    p_item_id: parsed.data.item_id,
    p_count: parsed.data.count,
    p_prefix: parsed.data.prefix,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/inventory/${parsed.data.item_id}`);
  return { success: true, inserted: data as number };
}

const UnitSchema = z.object({
  tag: z.string().min(1).max(50),
  serial_number: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  condition: z.enum(["good", "needs_repair", "broken", "retired"]),
  acquired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_active: z.boolean(),
});

function parseUnitForm(formData: FormData) {
  const str = (k: string) => String(formData.get(k) || "").trim() || null;
  return {
    tag: String(formData.get("tag") || "").trim().toUpperCase(),
    serial_number: str("serial_number"),
    notes: str("notes"),
    condition: String(formData.get("condition") || "good") as any,
    acquired_date: str("acquired_date"),
    is_active: formData.get("is_active") === "on",
  };
}

export async function createUnit(itemId: string, formData: FormData) {
  await requireAdmin();
  const parsed = UnitSchema.safeParse(parseUnitForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_units").insert({
    inventory_item_id: itemId,
    ...parsed.data,
  });
  if (error) {
    if (error.code === "23505") return { error: `Tag "${parsed.data.tag}" already used on this item` };
    return { error: error.message };
  }
  revalidatePath(`/admin/inventory/${itemId}`);
  return { success: true };
}

export async function updateUnit(unitId: string, itemId: string, formData: FormData) {
  await requireAdmin();
  const parsed = UnitSchema.safeParse(parseUnitForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const updates: any = { ...parsed.data };
  // If marking inactive or condition=retired, snapshot retired_at
  if (!parsed.data.is_active || parsed.data.condition === "retired") {
    updates.retired_at = new Date().toISOString();
  } else {
    updates.retired_at = null;
  }
  const { error } = await supabase
    .from("inventory_units")
    .update(updates)
    .eq("id", unitId);
  if (error) {
    if (error.code === "23505") return { error: `Tag "${parsed.data.tag}" already used on this item` };
    return { error: error.message };
  }
  revalidatePath(`/admin/inventory/${itemId}`);
  return { success: true };
}

export async function deleteUnit(unitId: string, itemId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  // Check if assigned to any active route
  const { count } = await supabase
    .from("dispatch_route_units")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", unitId)
    .is("returned_at", null);
  if ((count || 0) > 0) {
    return {
      error: `Unit is currently assigned to an active route. Mark it returned first or retire it instead.`,
    };
  }
  const { error } = await supabase.from("inventory_units").delete().eq("id", unitId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/inventory/${itemId}`);
  return { success: true };
}

/** Toggle whether an item tracks individual units. Doesn't generate units —
 *  use bulkGenerateUnits for that. */
export async function setTracksUnits(itemId: string, tracks: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ tracks_units: tracks })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/inventory/${itemId}`);
  return { success: true };
}
