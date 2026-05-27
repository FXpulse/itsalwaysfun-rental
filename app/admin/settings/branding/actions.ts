"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/db";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const BrandingInput = z.object({
  business_name: z.string().min(1).max(200).optional(),
  logo_url: z.string().url().or(z.literal("")).optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use hex like #1a1a6e").optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  font_family: z.string().max(60).optional(),
});

export async function saveBranding(formData: FormData) {
  const me = await requireAdmin();
  const tenantId = getCurrentTenantId();

  const parsed = BrandingInput.safeParse({
    business_name: String(formData.get("business_name") || "").trim() || undefined,
    logo_url: String(formData.get("logo_url") || "").trim(),
    primary_color: String(formData.get("primary_color") || "").trim() || undefined,
    accent_color: String(formData.get("accent_color") || "").trim() || undefined,
    font_family: String(formData.get("font_family") || "").trim() || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
    };
  }

  const supabase = createAdminClient({ unscoped: true });

  // Fetch existing branding to merge (don't blow away other keys)
  const { data: existing } = await supabase
    .from("tenants")
    .select("branding")
    .eq("id", tenantId)
    .single();

  const newBranding = {
    ...(existing?.branding as Record<string, any>),
    ...(parsed.data.logo_url !== undefined ? { logo_url: parsed.data.logo_url } : {}),
    ...(parsed.data.primary_color ? { primary_color: parsed.data.primary_color } : {}),
    ...(parsed.data.accent_color ? { accent_color: parsed.data.accent_color } : {}),
    ...(parsed.data.font_family ? { font_family: parsed.data.font_family } : {}),
  };

  const updates: any = { branding: newBranding };
  if (parsed.data.business_name) {
    updates.business_name = parsed.data.business_name;
  }

  const { error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenantId);

  if (error) return { error: error.message };

  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "tenant.branding_updated",
    entityType: "tenant",
    entityId: tenantId,
    details: { fields: Object.keys(parsed.data) },
  });

  revalidatePath("/admin/settings/branding");
  revalidatePath("/", "layout"); // re-render whole tree to pick up new CSS vars
  return { success: true };
}
