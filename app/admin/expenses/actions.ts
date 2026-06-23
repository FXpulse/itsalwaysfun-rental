"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

const NewExpenseSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  account: z.enum(["credit_card", "bank", "bank_zelle", "cash", "check", "other"]),
  category: z.string().min(1).max(40),
  vendor_name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().nullable(),
  amount_dollars: z.number().min(0).max(1_000_000),
  contractor_name: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function createBusinessExpense(formData: FormData) {
  const user = await requireAdmin();
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "Tenant context missing" };

  const parsed = NewExpenseSchema.safeParse({
    expense_date: String(formData.get("expense_date") || ""),
    account: String(formData.get("account") || "other") as any,
    category: String(formData.get("category") || "other"),
    vendor_name: String(formData.get("vendor_name") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    amount_dollars: Number(formData.get("amount_dollars") || 0),
    contractor_name: String(formData.get("contractor_name") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("business_expenses").insert({
    tenant_id: tenantId,
    expense_date: parsed.data.expense_date,
    account: parsed.data.account,
    category: parsed.data.category,
    vendor_name: parsed.data.vendor_name,
    description: parsed.data.description,
    amount_cents: Math.round(parsed.data.amount_dollars * 100),
    contractor_name: parsed.data.contractor_name,
    notes: parsed.data.notes,
    recorded_by: user.email || "admin",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/expenses");
  return { success: true };
}

export async function deleteBusinessExpense(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("business_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/expenses");
  return { success: true };
}
