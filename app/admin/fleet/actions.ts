"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const VehicleSchema = z.object({
  name: z.string().min(1).max(200),
  vehicle_type: z.enum(["truck", "van", "pickup", "other"]),
  requires_trailer: z.boolean(),
  capacity_notes: z.string().max(500).optional().nullable(),
  vin: z.string().max(50).optional().nullable(),
  license_tag: z.string().max(20).optional().nullable(),
  compatible_inventory_item_ids: z.array(z.string().uuid()).default([]),
  is_active: z.boolean(),
});

const TrailerSchema = z.object({
  name: z.string().min(1).max(200),
  capacity_notes: z.string().max(500).optional().nullable(),
  vin: z.string().max(50).optional().nullable(),
  license_tag: z.string().max(20).optional().nullable(),
  compatible_inventory_item_ids: z.array(z.string().uuid()).default([]),
  is_active: z.boolean(),
});

function cleanIdentifier(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase();
  return trimmed || null;
}

function parseVehicleForm(formData: FormData) {
  const compatIds = (formData.getAll("compatible_inventory_item_ids") as string[]).filter(Boolean);
  return {
    name: String(formData.get("name") || ""),
    vehicle_type: String(formData.get("vehicle_type") || "truck"),
    requires_trailer: formData.get("requires_trailer") === "on",
    capacity_notes: String(formData.get("capacity_notes") || "") || null,
    vin: cleanIdentifier(String(formData.get("vin") || "")),
    license_tag: cleanIdentifier(String(formData.get("license_tag") || "")),
    compatible_inventory_item_ids: compatIds,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createVehicle(formData: FormData) {
  await requireAdmin();
  const parsed = VehicleSchema.safeParse(parseVehicleForm(formData));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

export async function updateVehicle(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = VehicleSchema.safeParse(parseVehicleForm(formData));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

export async function deleteVehicle(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("dispatch_routes")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", id);
  if ((count ?? 0) > 0) {
    return { error: "Cannot delete — this vehicle is used in dispatch routes. Set inactive instead." };
  }
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

function parseTrailerForm(formData: FormData) {
  const compatIds = (formData.getAll("compatible_inventory_item_ids") as string[]).filter(Boolean);
  return {
    name: String(formData.get("name") || ""),
    capacity_notes: String(formData.get("capacity_notes") || "") || null,
    vin: cleanIdentifier(String(formData.get("vin") || "")),
    license_tag: cleanIdentifier(String(formData.get("license_tag") || "")),
    compatible_inventory_item_ids: compatIds,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createTrailer(formData: FormData) {
  await requireAdmin();
  const parsed = TrailerSchema.safeParse(parseTrailerForm(formData));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("trailers").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

export async function updateTrailer(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = TrailerSchema.safeParse(parseTrailerForm(formData));
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("trailers").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

export async function deleteTrailer(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("dispatch_routes")
    .select("id", { count: "exact", head: true })
    .eq("trailer_id", id);
  if ((count ?? 0) > 0) {
    return { error: "Cannot delete — this trailer is used in dispatch routes. Set inactive instead." };
  }
  const { error } = await supabase.from("trailers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}
