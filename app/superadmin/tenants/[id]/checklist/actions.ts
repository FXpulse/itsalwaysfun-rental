"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireSuperadmin() {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const supabase = createAdminClient({ unscoped: true });
  const { data: role } = await supabase
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  return role ? user : null;
}

export async function toggleChecklistItem(
  tenantId: string,
  itemKey: string,
  is_completed: boolean,
  notes?: string,
) {
  const me = await requireSuperadmin();
  if (!me) return { error: "unauthorized" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("tenant_onboarding_checklist")
    .upsert({
      tenant_id: tenantId,
      item_key: itemKey,
      is_completed,
      completed_at: is_completed ? new Date().toISOString() : null,
      completed_by_email: is_completed ? me.email : null,
      notes: notes ?? undefined,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,item_key" });

  if (error) return { error: error.message };

  revalidatePath(`/superadmin/tenants/${tenantId}/checklist`);
  revalidatePath(`/superadmin/tenants/${tenantId}`);
  return { ok: true };
}

export async function updateChecklistItemNotes(
  tenantId: string,
  itemKey: string,
  notes: string,
) {
  const me = await requireSuperadmin();
  if (!me) return { error: "unauthorized" };

  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("tenant_onboarding_checklist")
    .upsert({
      tenant_id: tenantId,
      item_key: itemKey,
      notes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,item_key" });

  revalidatePath(`/superadmin/tenants/${tenantId}/checklist`);
  return { ok: true };
}

export async function addOperatorNote(
  tenantId: string,
  input: { note_type: string; subject: string; body: string; follow_up_date?: string },
) {
  const me = await requireSuperadmin();
  if (!me) return { error: "unauthorized" };

  if (!input.body.trim()) return { error: "body_required" };

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase.from("tenant_operator_notes").insert({
    tenant_id: tenantId,
    note_type: input.note_type,
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    follow_up_date: input.follow_up_date || null,
    created_by_email: me.email,
  });

  if (error) return { error: error.message };

  revalidatePath(`/superadmin/tenants/${tenantId}/checklist`);
  return { ok: true };
}

export async function resolveOperatorNote(noteId: string, tenantId: string) {
  const me = await requireSuperadmin();
  if (!me) return { error: "unauthorized" };

  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("tenant_operator_notes")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", noteId);

  revalidatePath(`/superadmin/tenants/${tenantId}/checklist`);
  return { ok: true };
}

export async function deleteOperatorNote(noteId: string, tenantId: string) {
  const me = await requireSuperadmin();
  if (!me) return { error: "unauthorized" };

  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("tenant_operator_notes").delete().eq("id", noteId);

  revalidatePath(`/superadmin/tenants/${tenantId}/checklist`);
  return { ok: true };
}

export async function updateTenantProfile(
  tenantId: string,
  patch: Record<string, any>,
) {
  const me = await requireSuperadmin();
  if (!me) return { error: "unauthorized" };

  const allowedKeys = [
    "industry", "employees_count", "year_founded", "market_size",
    "primary_goal", "pain_points", "bookings_per_month_avg", "revenue_tier",
    "decision_maker_name", "decision_maker_phone", "decision_maker_role",
    "acquisition_source", "account_status", "notes",
  ];
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (allowedKeys.includes(k)) filtered[k] = v === "" ? null : v;
  }
  filtered.updated_at = new Date().toISOString();
  filtered.updated_by_email = me.email;

  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("tenant_profile")
    .upsert({ tenant_id: tenantId, ...filtered }, { onConflict: "tenant_id" });

  revalidatePath(`/superadmin/tenants/${tenantId}/checklist`);
  revalidatePath(`/superadmin/tenants/${tenantId}`);
  return { ok: true };
}
