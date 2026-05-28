"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { withTenant } from "@/lib/tenant/db";

const SurfaceInputSchema = z.object({
  value: z
    .string()
    .min(2)
    .max(40)
    .regex(
      /^[a-z0-9][a-z0-9_-]*$/,
      "Use lowercase letters, numbers, hyphens or underscores (e.g. 'sand', 'wood_deck').",
    ),
  label: z.string().min(2).max(60),
  display_order: z.number().int().min(0).max(999).default(0),
});

export async function createSurface(formData: FormData) {
  await requireAdmin();
  const parsed = SurfaceInputSchema.safeParse({
    value: String(formData.get("value") || "").trim().toLowerCase(),
    label: String(formData.get("label") || "").trim(),
    display_order: Number(formData.get("display_order") || 0),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("setup_surfaces")
    .insert(withTenant({ ...parsed.data, is_active: true }));
  if (error) {
    if (error.code === "23505") {
      return { error: `A surface with value "${parsed.data.value}" already exists.` };
    }
    return { error: error.message };
  }
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function updateSurface(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = SurfaceInputSchema.safeParse({
    value: String(formData.get("value") || "").trim().toLowerCase(),
    label: String(formData.get("label") || "").trim(),
    display_order: Number(formData.get("display_order") || 0),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("setup_surfaces")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function toggleSurfaceActive(id: string, currentlyActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("setup_surfaces")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function deleteSurface(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  // Surfaces are referenced by bookings.surface_type / quotes.surface_type but
  // those columns are now free-form text (no FK). Past bookings keep their
  // recorded value even if the option is later deleted — they just won't be
  // selectable for NEW bookings.
  const { error } = await supabase.from("setup_surfaces").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true };
}
