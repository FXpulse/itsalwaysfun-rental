"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireSuperadmin() {
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const supabase = createAdminClient({ unscoped: true });
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  return roleRow ? user : null;
}

export async function createGoal(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const user = await requireSuperadmin();
  if (!user) return { error: "unauthorized" };

  const metric = (formData.get("metric") || "").toString();
  const target = parseFloat((formData.get("target") || "").toString());
  const target_date = (formData.get("target_date") || "").toString();
  const label = (formData.get("label") || "").toString().trim() || null;

  if (!metric || !target || !target_date) return { error: "missing_fields" };
  if (!["mrr", "active_tenants", "paying_tenants", "signups_30d"].includes(metric)) {
    return { error: "invalid_metric" };
  }

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("superadmin_goals").insert({
    metric,
    target,
    target_date,
    label,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/superadmin/goals");
  revalidatePath("/superadmin/dashboard");
  return { ok: true };
}

export async function deleteGoal(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireSuperadmin();
  if (!user) return { error: "unauthorized" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("superadmin_goals")
    .update({ is_active: false })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/superadmin/goals");
  revalidatePath("/superadmin/dashboard");
  return { ok: true };
}
