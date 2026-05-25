"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaffOrAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const ReqSchema = z.object({
  product_id: z.string().uuid(),
  inventory_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  surface_types: z.array(z.string()).optional(),
  only_when_needs_power: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function addInventoryRequirement(formData: FormData) {
  await requireAdmin();
  const surfaces = (formData.getAll("surface_types") as string[]).filter(Boolean);

  const parsed = ReqSchema.safeParse({
    product_id: String(formData.get("product_id") || ""),
    inventory_item_id: String(formData.get("inventory_item_id") || ""),
    quantity: parseInt(String(formData.get("quantity") || "1"), 10),
    surface_types: surfaces.length > 0 ? surfaces : undefined,
    only_when_needs_power: formData.get("only_when_needs_power") === "on",
    notes: (formData.get("notes") as string)?.trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("product_inventory_requirements").insert({
    product_id: parsed.data.product_id,
    inventory_item_id: parsed.data.inventory_item_id,
    quantity: parsed.data.quantity,
    surface_types:
      parsed.data.surface_types && parsed.data.surface_types.length > 0
        ? parsed.data.surface_types
        : null,
    only_when_needs_power: parsed.data.only_when_needs_power || false,
    notes: parsed.data.notes,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/products/${parsed.data.product_id}`);
  return { success: true };
}

export async function deleteInventoryRequirement(id: string, productId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("product_inventory_requirements")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/products/${productId}`);
  return { success: true };
}

/** Staff or admin marks the booking delivery as fully loaded/checked. */
export async function markDeliveryChecked(bookingId: string) {
  const me = await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({
      delivery_checked_at: new Date().toISOString(),
      delivery_checked_by: me.email,
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}

/** Clears the delivery check (e.g., re-doing it). */
export async function clearDeliveryCheck(bookingId: string) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({
      delivery_checked_at: null,
      delivery_checked_by: null,
    })
    .eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true };
}
