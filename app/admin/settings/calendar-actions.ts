"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantId } from "@/lib/tenant/server";

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function generateCalendarToken(): Promise<{ token: string } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };

  const supabase = createAdminClient({ unscoped: true });
  // If one already exists, return it (idempotent)
  const { data: existing } = await supabase
    .from("tenants")
    .select("calendar_feed_token")
    .eq("id", tenantId)
    .maybeSingle();
  if (existing?.calendar_feed_token) return { token: existing.calendar_feed_token };

  const token = newToken();
  const { error } = await supabase
    .from("tenants")
    .update({ calendar_feed_token: token })
    .eq("id", tenantId);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { token };
}

export async function regenerateCalendarToken(): Promise<{ token: string } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };

  const supabase = createAdminClient({ unscoped: true });
  const token = newToken();
  const { error } = await supabase
    .from("tenants")
    .update({ calendar_feed_token: token })
    .eq("id", tenantId);
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { token };
}
