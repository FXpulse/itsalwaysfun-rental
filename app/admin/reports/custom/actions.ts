"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReportDefinition } from "@/lib/admin/report-engine";

export async function saveReport(input: {
  id?: string;
  name: string;
  description?: string;
  definition: ReportDefinition;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };

  if (!input.name.trim()) return { error: "name_required" };
  if (!input.definition.dimensions?.length) return { error: "at_least_one_dimension" };
  if (!input.definition.metrics?.length) return { error: "at_least_one_metric" };

  const supabase = createAdminClient({ unscoped: true });

  if (input.id) {
    const { data, error } = await supabase
      .from("custom_reports")
      .update({
        name: input.name,
        description: input.description || null,
        definition: input.definition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("tenant_id", tenantId)
      .select("id")
      .single();
    if (error || !data) return { error: error?.message || "update_failed" };
    revalidatePath("/admin/reports/custom");
    revalidatePath(`/admin/reports/custom/${input.id}`);
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("custom_reports")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      description: input.description || null,
      definition: input.definition,
      created_by_email: me.email,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message || "create_failed" };

  revalidatePath("/admin/reports/custom");
  return { ok: true, id: (data as any).id };
}

export async function deleteReport(id: string): Promise<{ ok: true } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("custom_reports")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  revalidatePath("/admin/reports/custom");
  return { ok: true };
}

export async function toggleFavorite(id: string, fav: boolean) {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };
  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("custom_reports")
    .update({ is_favorite: fav })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  revalidatePath("/admin/reports/custom");
  return { ok: true };
}
