"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const KeyRule = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, "key must be lowercase letters, numbers, underscores");

const CategoryCreateInput = z.object({
  key: KeyRule,
  label: z.string().min(1).max(120),
  group_name: z.string().max(60).optional().nullable(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

const CategoryUpdateInput = z.object({
  label: z.string().min(1).max(120),
  group_name: z.string().max(60).optional().nullable(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export async function createCategory(formData: FormData) {
  const me = await requireAdmin();
  const rawLabel = String(formData.get("label") || "").trim();
  const rawKey = String(formData.get("key") || "").trim() || slugify(rawLabel);
  const rawGroup = String(formData.get("group_name") || "").trim() || null;
  const rawSort = parseInt(String(formData.get("sort_order") || "100"), 10) || 100;

  const parsed = CategoryCreateInput.safeParse({
    key: rawKey,
    label: rawLabel,
    group_name: rawGroup,
    sort_order: rawSort,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("overhead_categories").insert({
    key: parsed.data.key,
    label: parsed.data.label,
    group_name: parsed.data.group_name,
    sort_order: parsed.data.sort_order ?? 100,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: `Category key "${parsed.data.key}" already exists` };
    }
    return { error: error.message };
  }
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead_category.created",
    entityType: "overhead_category",
    entityId: parsed.data.key,
    details: parsed.data,
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}

export async function updateCategory(key: string, formData: FormData) {
  const me = await requireAdmin();
  if (!KeyRule.safeParse(key).success) return { error: "Invalid key" };
  const rawLabel = String(formData.get("label") || "").trim();
  const rawGroup = String(formData.get("group_name") || "").trim() || null;
  const rawSort = parseInt(String(formData.get("sort_order") || "100"), 10) || 100;
  const isActiveStr = String(formData.get("is_active") || "true");
  const parsed = CategoryUpdateInput.safeParse({
    label: rawLabel,
    group_name: rawGroup,
    sort_order: rawSort,
    is_active: isActiveStr === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("overhead_categories")
    .update(parsed.data)
    .eq("key", key);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead_category.updated",
    entityType: "overhead_category",
    entityId: key,
    details: parsed.data,
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}

export async function toggleCategoryActive(key: string, nextActive: boolean) {
  const me = await requireAdmin();
  if (!KeyRule.safeParse(key).success) return { error: "Invalid key" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("overhead_categories")
    .update({ is_active: nextActive })
    .eq("key", key);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: nextActive ? "overhead_category.activated" : "overhead_category.deactivated",
    entityType: "overhead_category",
    entityId: key,
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}

/** Hard-delete a category. Refuses if any overhead_costs row still uses it. */
export async function deleteCategory(key: string) {
  const me = await requireAdmin();
  if (!KeyRule.safeParse(key).success) return { error: "Invalid key" };
  const supabase = createAdminClient();
  const { count, error: countErr } = await supabase
    .from("overhead_costs")
    .select("id", { count: "exact", head: true })
    .eq("category", key);
  if (countErr) return { error: countErr.message };
  if ((count || 0) > 0) {
    return {
      error: `Cannot delete — ${count} overhead row(s) still use this category. Deactivate instead, or reassign those rows first.`,
    };
  }
  const { error } = await supabase.from("overhead_categories").delete().eq("key", key);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead_category.deleted",
    entityType: "overhead_category",
    entityId: key,
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}
