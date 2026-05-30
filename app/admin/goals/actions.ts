"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_METRICS = ["bookings_30d", "revenue_30d", "customers_30d", "repeat_rate"];

export async function createTenantGoal(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };

  const metric = (formData.get("metric") || "").toString();
  const target = parseFloat((formData.get("target") || "").toString());
  const target_date = (formData.get("target_date") || "").toString();
  const label = (formData.get("label") || "").toString().trim() || null;

  if (!metric || !target || !target_date) return { error: "missing_fields" };
  if (!ALLOWED_METRICS.includes(metric)) return { error: "invalid_metric" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("tenant_goals").insert({
    tenant_id: tenantId, metric, target, target_date, label, is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/goals");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export async function deleteTenantGoal(id: string): Promise<{ ok: true } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };

  const supabase = createAdminClient({ unscoped: true });
  // Defense-in-depth: tenant must match
  const { error } = await supabase
    .from("tenant_goals")
    .update({ is_active: false })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  revalidatePath("/admin/goals");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
