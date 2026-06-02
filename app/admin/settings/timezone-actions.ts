"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { isValidTimezone, US_TIMEZONES } from "@/lib/tenant/timezone";

export async function updateTenantTimezone(timezone: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireStaffOrAdmin();
    if (!isValidTimezone(timezone)) {
      return { ok: false, error: "Invalid timezone" };
    }
    // Defense in depth: only accept timezones from our curated list so a typo
    // doesn't silently break formatting.
    if (!US_TIMEZONES.some((t) => t.id === timezone)) {
      return { ok: false, error: "Timezone must be one of the supported options" };
    }
    const tenantId = getCurrentTenantId();
    const supabase = createAdminClient({ unscoped: true });
    const { error } = await supabase
      .from("tenants")
      .update({ timezone })
      .eq("id", tenantId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (e: any) {
    console.error("updateTenantTimezone threw:", e);
    return { ok: false, error: e?.message || String(e) };
  }
}
