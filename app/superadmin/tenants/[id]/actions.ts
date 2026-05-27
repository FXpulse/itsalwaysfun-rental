"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit";

async function requireSuperadmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const admin = createAdminClient({ unscoped: true });
  const { data } = await admin
    .from("user_roles")
    .select("is_superadmin")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("is_superadmin", true)
    .maybeSingle();
  if (!data) throw new Error("Not a superadmin");
  return { id: user.id, email: user.email || "unknown" };
}

export async function suspendTenant(tenantId: string, reason: string) {
  const me = await requireSuperadmin();
  if (!reason?.trim()) return { error: "Reason required" };

  const admin = createAdminClient({ unscoped: true });
  const { error } = await admin
    .from("tenants")
    .update({
      suspended_at: new Date().toISOString(),
      suspended_reason: reason.trim(),
    })
    .eq("id", tenantId);
  if (error) return { error: error.message };

  await logAuditEvent({
    userEmail: me.email,
    action: "superadmin.tenant_suspended",
    entityType: "tenant",
    entityId: tenantId,
    details: { reason: reason.trim() },
  });

  revalidatePath(`/superadmin/tenants/${tenantId}`);
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export async function unsuspendTenant(tenantId: string) {
  const me = await requireSuperadmin();
  const admin = createAdminClient({ unscoped: true });
  const { error } = await admin
    .from("tenants")
    .update({ suspended_at: null, suspended_reason: null })
    .eq("id", tenantId);
  if (error) return { error: error.message };

  await logAuditEvent({
    userEmail: me.email,
    action: "superadmin.tenant_unsuspended",
    entityType: "tenant",
    entityId: tenantId,
  });

  revalidatePath(`/superadmin/tenants/${tenantId}`);
  revalidatePath("/superadmin/tenants");
  return { success: true };
}
