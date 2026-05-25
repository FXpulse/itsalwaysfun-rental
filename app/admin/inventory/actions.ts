"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaffOrAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const MaintenanceSchema = z.object({
  inventory_item_id: z.string().uuid(),
  type: z.enum(["cleaning", "repair", "inspection", "replacement", "other"]),
  description: z.string().min(1).max(500),
  cost_dollars: z.number().min(0),
  performed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  performed_by: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function logMaintenance(formData: FormData) {
  const me = await requireStaffOrAdmin();
  const parsed = MaintenanceSchema.safeParse({
    inventory_item_id: String(formData.get("inventory_item_id") || ""),
    type: String(formData.get("type") || "cleaning"),
    description: String(formData.get("description") || ""),
    cost_dollars: parseFloat(String(formData.get("cost_dollars") || "0")) || 0,
    performed_at: String(formData.get("performed_at") || new Date().toISOString().split("T")[0]),
    performed_by: (formData.get("performed_by") as string) || me.email,
    notes: (formData.get("notes") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_maintenance").insert({
    inventory_item_id: parsed.data.inventory_item_id,
    type: parsed.data.type,
    description: parsed.data.description,
    cost_cents: Math.round(parsed.data.cost_dollars * 100),
    performed_at: parsed.data.performed_at,
    performed_by: parsed.data.performed_by,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function deleteMaintenance(id: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_maintenance").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { success: true };
}

const ItemInput = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  quantity_owned: z.number().int().min(0),
  quantity_in_use: z.number().int().min(0),
  location: z.string().max(200).optional().nullable(),
  condition: z.enum(["good", "needs_repair", "broken", "retired"]),
  purchase_date: z.string().optional().nullable(),
  purchase_cost_dollars: z.number().min(0).optional().nullable(),
  last_maintenance_date: z.string().optional().nullable(),
  maintenance_notes: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean(),
});

function parseForm(formData: FormData) {
  const num = (key: string) => {
    const v = String(formData.get(key) || "").trim();
    return v ? parseFloat(v) : 0;
  };
  const str = (key: string) => String(formData.get(key) || "").trim() || null;
  const date = (key: string) => {
    const v = String(formData.get(key) || "").trim();
    return v || null;
  };
  return {
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "other").trim(),
    description: str("description"),
    quantity_owned: Math.round(num("quantity_owned")),
    quantity_in_use: Math.round(num("quantity_in_use")),
    location: str("location"),
    condition: String(formData.get("condition") || "good") as any,
    purchase_date: date("purchase_date"),
    purchase_cost_dollars: num("purchase_cost_dollars"),
    last_maintenance_date: date("last_maintenance_date"),
    maintenance_notes: str("maintenance_notes"),
    notes: str("notes"),
    is_active: formData.get("is_active") === "on",
  };
}

function toDbRow(data: z.infer<typeof ItemInput>) {
  const { purchase_cost_dollars, ...rest } = data;
  return {
    ...rest,
    purchase_cost_cents: Math.round((purchase_cost_dollars || 0) * 100),
  };
}

export async function createInventoryItem(formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = ItemInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  if (parsed.data.quantity_in_use > parsed.data.quantity_owned) {
    return { error: "Items in use cannot exceed total owned" };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_items").insert(toDbRow(parsed.data));
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function updateInventoryItem(id: string, formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = ItemInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  if (parsed.data.quantity_in_use > parsed.data.quantity_owned) {
    return { error: "Items in use cannot exceed total owned" };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("inventory_items")
    .update(toDbRow(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { success: true };
}

export async function deleteInventoryItem(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { success: true };
}

/** Quick adjustment for staff/admin: increment/decrement items in use.
 *  delta = +1 (item went out), -1 (item came back). */
export async function adjustInUse(id: string, delta: number) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("inventory_items")
    .select("quantity_owned, quantity_in_use")
    .eq("id", id)
    .single();
  if (!row) return { error: "Item not found" };

  const newInUse = (row.quantity_in_use || 0) + delta;
  if (newInUse < 0) return { error: "Items in use cannot go below 0" };
  if (newInUse > row.quantity_owned) return { error: "Cannot have more in use than owned" };

  const { error } = await supabase
    .from("inventory_items")
    .update({ quantity_in_use: newInUse })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { success: true, new_in_use: newInUse };
}

const ConditionSchema = z.enum(["good", "needs_repair", "broken", "retired"]);

/** Staff/admin can mark condition + add a maintenance note. */
export async function updateCondition(id: string, condition: string, note: string) {
  await requireStaffOrAdmin();
  const parsed = ConditionSchema.safeParse(condition);
  if (!parsed.success) return { error: "Invalid condition" };

  const supabase = createAdminClient();

  // Append maintenance note if provided
  const updates: any = {
    condition: parsed.data,
    last_maintenance_date: new Date().toISOString().split("T")[0],
  };
  if (note.trim()) {
    const { data: row } = await supabase
      .from("inventory_items")
      .select("maintenance_notes")
      .eq("id", id)
      .single();
    const ts = new Date().toISOString().split("T")[0];
    const newLine = `[${ts}] ${parsed.data}: ${note.trim()}`;
    updates.maintenance_notes = row?.maintenance_notes
      ? `${row.maintenance_notes}\n${newLine}`
      : newLine;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update(updates)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/inventory");
  return { success: true };
}
