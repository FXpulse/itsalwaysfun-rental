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
  is_active: z.boolean(),
});

const TrailerSchema = z.object({
  name: z.string().min(1).max(200),
  capacity_notes: z.string().max(500).optional().nullable(),
  is_active: z.boolean(),
});

export async function createVehicle(formData: FormData) {
  await requireAdmin();
  const parsed = VehicleSchema.safeParse({
    name: String(formData.get("name") || ""),
    vehicle_type: String(formData.get("vehicle_type") || "truck"),
    requires_trailer: formData.get("requires_trailer") === "on",
    capacity_notes: String(formData.get("capacity_notes") || "") || null,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

export async function updateVehicle(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = VehicleSchema.safeParse({
    name: String(formData.get("name") || ""),
    vehicle_type: String(formData.get("vehicle_type") || "truck"),
    requires_trailer: formData.get("requires_trailer") === "on",
    capacity_notes: String(formData.get("capacity_notes") || "") || null,
    is_active: formData.get("is_active") === "on",
  });
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

export async function createTrailer(formData: FormData) {
  await requireAdmin();
  const parsed = TrailerSchema.safeParse({
    name: String(formData.get("name") || ""),
    capacity_notes: String(formData.get("capacity_notes") || "") || null,
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.errors.map((e) => e.message).join(", ") };

  const supabase = createAdminClient();
  const { error } = await supabase.from("trailers").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/admin/fleet");
  return { success: true };
}

export async function updateTrailer(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = TrailerSchema.safeParse({
    name: String(formData.get("name") || ""),
    capacity_notes: String(formData.get("capacity_notes") || "") || null,
    is_active: formData.get("is_active") === "on",
  });
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
