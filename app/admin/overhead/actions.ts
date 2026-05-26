"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const OverheadInput = z.object({
  name: z.string().min(1).max(200),
  // Category is a dynamic key from overhead_categories. Validate it's a sane
  // identifier (lowercase letters, numbers, underscores) — the form's dropdown
  // only shows active rows from overhead_categories, so this is just a guard
  // against tampering.
  category: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  monthly_dollars: z.number().min(0),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

function parseForm(formData: FormData) {
  return {
    name: String(formData.get("name") || "").trim(),
    category: String(formData.get("category") || "other") as any,
    monthly_dollars: parseFloat(String(formData.get("monthly_dollars") || "0")),
    effective_from:
      String(formData.get("effective_from") || "") ||
      new Date().toISOString().split("T")[0],
    effective_to: (formData.get("effective_to") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };
}

function toRow(data: z.infer<typeof OverheadInput>) {
  const { monthly_dollars, ...rest } = data;
  return {
    ...rest,
    monthly_cents: Math.round(monthly_dollars * 100),
  };
}

export async function createOverhead(formData: FormData) {
  const me = await requireAdmin();
  const parsed = OverheadInput.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const row = toRow(parsed.data);
  const { data: inserted, error } = await supabase
    .from("overhead_costs")
    .insert(row)
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead.created",
    entityType: "overhead_cost",
    entityId: inserted?.id,
    details: { name: row.name, monthly_cents: row.monthly_cents, category: row.category },
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}

export async function updateOverhead(id: string, formData: FormData) {
  const me = await requireAdmin();
  const parsed = OverheadInput.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const row = toRow(parsed.data);
  const { error } = await supabase.from("overhead_costs").update(row).eq("id", id);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead.updated",
    entityType: "overhead_cost",
    entityId: id,
    details: row,
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}

export async function endOverhead(id: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("overhead_costs")
    .update({ effective_to: today })
    .eq("id", id);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead.ended",
    entityType: "overhead_cost",
    entityId: id,
    details: { ended_on: today },
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}

export async function deleteOverhead(id: string) {
  const me = await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("overhead_costs").delete().eq("id", id);
  if (error) return { error: error.message };
  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "overhead.deleted",
    entityType: "overhead_cost",
    entityId: id,
  });
  revalidatePath("/admin/overhead");
  return { success: true };
}
