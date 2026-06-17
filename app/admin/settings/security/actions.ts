"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";

/** Toggle the per-tenant "require admin MFA" policy. Admin-role only. */
export async function setRequireAdminMfa(value: boolean) {
  await requireAdmin();
  const tenantId = getCurrentTenantId();
  if (!tenantId || tenantId === "__marketing__") {
    return { error: "no_tenant" };
  }
  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        tenant_id: tenantId,
        key: "require_admin_mfa",
        value: value ? "true" : "false",
        description:
          "When true, admin users without 2FA enrolled are blocked from /admin until they enroll.",
        category: "security",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,key" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/settings/security");
  return { ok: true };
}
