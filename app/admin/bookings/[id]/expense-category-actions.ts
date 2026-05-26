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

const CreateInput = z.object({
  key: KeyRule,
  label: z.string().min(1).max(120),
  sort_order: z.number().int().min(0).max(9999).optional(),
  supports_payroll_hours: z.boolean().optional(),
});

const UpdateInput = z.object({
  label: z.string().min(1).max(120),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
  supports_payroll_hours: z.boolean().optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export async function createExpenseCategory(formData: FormData) {
  const me = await requireAdmin();
  const rawLabel = String(formData.get("label") || "").trim();
  const rawKey = String(formData.get("key") || "").trim() || slugify(rawLabel);
  const rawSort = parseInt(String(formData.get("sort_order") || "100"), 10) || 100;
  const supportsHours = String(formData.get("supports_payroll_hours") || "") === "true";

  const parsed = CreateInput.safeParse({
    key: rawKey,
    label: rawLabel,
    sort_order: rawSort,
    supports_payroll_hours: supportsHours,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("booking_expense_categories").insert({
    key: parsed.data.key,
    label: parsed.data.label,
    sort_order: parsed.data.sort_order ?? 100,
    supports_payroll_hours: parsed.data.supports_payroll_hours ?? false,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: `Category key "${parsed.data.key}" already exists` };
    }
    return { error: error.message };
  }
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "expense_category.created",
    entityType: "booking_expense_category",
    entityId: parsed.data.key,
    details: parsed.data,
  });
  return { success: true };
}

export async function updateExpenseCategory(key: string, formData: FormData) {
  const me = await requireAdmin();
  if (!KeyRule.safeParse(key).success) return { error: "Invalid key" };
  const rawLabel = String(formData.get("label") || "").trim();
  const rawSort = parseInt(String(formData.get("sort_order") || "100"), 10) || 100;
  const isActive = String(formData.get("is_active") || "true") === "true";
  const supportsHours = String(formData.get("supports_payroll_hours") || "") === "true";

  const parsed = UpdateInput.safeParse({
    label: rawLabel,
    sort_order: rawSort,
    is_active: isActive,
    supports_payroll_hours: supportsHours,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_expense_categories")
    .update(parsed.data)
    .eq("key", key);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "expense_category.updated",
    entityType: "booking_expense_category",
    entityId: key,
    details: parsed.data,
  });
  return { success: true };
}

export async function toggleExpenseCategoryActive(key: string, nextActive: boolean) {
  const me = await requireAdmin();
  if (!KeyRule.safeParse(key).success) return { error: "Invalid key" };
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("booking_expense_categories")
    .update({ is_active: nextActive })
    .eq("key", key);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: nextActive ? "expense_category.activated" : "expense_category.deactivated",
    entityType: "booking_expense_category",
    entityId: key,
  });
  return { success: true };
}

export async function deleteExpenseCategory(key: string) {
  const me = await requireAdmin();
  if (!KeyRule.safeParse(key).success) return { error: "Invalid key" };
  const supabase = createAdminClient();
  const { count, error: countErr } = await supabase
    .from("booking_expenses")
    .select("id", { count: "exact", head: true })
    .eq("category", key);
  if (countErr) return { error: countErr.message };
  if ((count || 0) > 0) {
    return {
      error: `Cannot delete — ${count} booking expense(s) still use this category. Deactivate instead.`,
    };
  }
  const { error } = await supabase
    .from("booking_expense_categories")
    .delete()
    .eq("key", key);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "expense_category.deleted",
    entityType: "booking_expense_category",
    entityId: key,
  });
  return { success: true };
}
