"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SECTION_DEFS, getSectionDef } from "@/lib/admin/home-sections";

export async function upsertSection(input: {
  section_type: string;
  is_enabled: boolean;
  display_order: number;
  content: Record<string, string>;
}): Promise<{ ok: true } | { error: string }> {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") return { error: "unauthorized" };
  const tenantId = getCurrentTenantId();
  if (!tenantId) return { error: "no_tenant" };

  const def = getSectionDef(input.section_type);
  if (!def) return { error: "invalid_section_type" };

  // Only keep fields defined for this section type (defense in depth)
  const allowedKeys = new Set(def.fields.map((f) => f.key));
  const filteredContent: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.content)) {
    if (allowedKeys.has(k)) filteredContent[k] = String(v).slice(0, 5000);
  }

  const supabase = createAdminClient({ unscoped: true });
  const { error } = await supabase
    .from("tenant_home_sections")
    .upsert(
      {
        tenant_id: tenantId,
        section_type: input.section_type,
        is_enabled: input.is_enabled,
        display_order: input.display_order,
        content: filteredContent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,section_type" },
    );
  if (error) return { error: error.message };

  revalidatePath("/admin/site/sections");
  revalidatePath("/", "layout");        // bust public home cache
  return { ok: true };
}
