"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { getCurrentTenantId } from "@/lib/tenant/server";
import { logAuditEvent } from "@/lib/audit";

const BusinessInfoInput = z.object({
  business_name: z.string().min(2).max(200),
  owner_phone: z.string().max(40).optional().nullable(),
  business_address: z.string().max(400).optional().nullable(),
  business_email: z.string().email().optional().or(z.literal("")),
});

export async function saveOnboardingBusinessInfo(formData: FormData) {
  await requireAdmin();
  const tenantId = getCurrentTenantId();

  const parsed = BusinessInfoInput.safeParse({
    business_name: String(formData.get("business_name") || "").trim(),
    owner_phone: String(formData.get("owner_phone") || "").trim() || null,
    business_address: String(formData.get("business_address") || "").trim() || null,
    business_email: String(formData.get("business_email") || "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = createAdminClient({ unscoped: true });

  // Tenant row: business_name + owner_phone
  await supabase
    .from("tenants")
    .update({
      business_name: parsed.data.business_name,
      owner_phone: parsed.data.owner_phone,
    })
    .eq("id", tenantId);

  // site_settings (scoped client so tenant_id is applied automatically on insert)
  const scoped = createAdminClient();
  const updates: { key: string; value: string }[] = [
    { key: "business_name", value: parsed.data.business_name },
  ];
  if (parsed.data.owner_phone) updates.push({ key: "business_phone", value: parsed.data.owner_phone });
  if (parsed.data.business_address) updates.push({ key: "business_address", value: parsed.data.business_address });
  if (parsed.data.business_email) updates.push({ key: "business_email", value: parsed.data.business_email });

  for (const u of updates) {
    const { data: existing } = await scoped
      .from("site_settings")
      .select("key")
      .eq("key", u.key)
      .maybeSingle();
    if (existing) {
      await scoped.from("site_settings").update({ value: u.value }).eq("key", u.key);
    } else {
      await scoped.from("site_settings").insert({ key: u.key, value: u.value, category: "general" });
    }
  }

  return { success: true };
}

const ProductInput = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  price_per_day_dollars: z.coerce.number().min(0).max(100000),
  stock: z.coerce.number().int().min(1).max(1000),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "rental-item";
}

export async function createOnboardingProduct(formData: FormData) {
  await requireAdmin();

  const parsed = ProductInput.safeParse({
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    price_per_day_dollars: formData.get("price_per_day_dollars"),
    stock: formData.get("stock"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = createAdminClient();
  const slug = slugify(parsed.data.name);

  // Ensure slug is unique within this tenant; add suffix if needed
  let finalSlug = slug;
  let n = 2;
  while (true) {
    const { data: exists } = await supabase
      .from("products")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (!exists) break;
    finalSlug = `${slug}-${n++}`;
    if (n > 50) return { error: "Could not generate a unique slug" };
  }

  const { error } = await supabase.from("products").insert({
    name: parsed.data.name,
    slug: finalSlug,
    description: parsed.data.description,
    category: "General",
    price_per_day: Math.round(parsed.data.price_per_day_dollars * 100),
    stock: parsed.data.stock,
    is_active: true,
  });
  if (error) return { error: error.message };

  return { success: true };
}

const SeoInput = z.object({
  google_business_profile_url: z.string().max(500).optional().nullable(),
  seo_google_verification: z.string().max(200).optional().nullable(),
});

export async function saveOnboardingSeo(formData: FormData) {
  await requireAdmin();
  const parsed = SeoInput.safeParse({
    google_business_profile_url:
      String(formData.get("google_business_profile_url") || "").trim() || null,
    seo_google_verification:
      String(formData.get("seo_google_verification") || "").trim() || null,
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const scoped = createAdminClient();
  const updates: { key: string; value: string }[] = [];
  if (parsed.data.google_business_profile_url) {
    updates.push({ key: "google_business_profile_url", value: parsed.data.google_business_profile_url });
  }
  if (parsed.data.seo_google_verification) {
    // Strip wrapping <meta ...content="..."> if user pasted the full tag
    const raw = parsed.data.seo_google_verification;
    const m = raw.match(/content=["']([^"']+)["']/i);
    updates.push({ key: "seo_google_verification", value: m ? m[1]! : raw });
  }
  for (const u of updates) {
    await scoped
      .from("site_settings")
      .upsert({ key: u.key, value: u.value, category: "seo" }, { onConflict: "tenant_id,key" });
  }
  return { success: true };
}

export async function finishOnboarding() {
  const me = await requireAdmin();
  const tenantId = getCurrentTenantId();

  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("tenants")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", tenantId);

  await logAuditEvent({
    userEmail: me.email || "unknown",
    action: "tenant.onboarding_completed",
    entityType: "tenant",
    entityId: tenantId,
    details: {},
  });

  revalidatePath("/admin", "layout");
  redirect("/admin/dashboard");
}

/** Skip the wizard without doing anything. Sets the completion timestamp
 *  so the user isn't trapped if they want to set things up later. */
export async function skipOnboarding() {
  await requireAdmin();
  const tenantId = getCurrentTenantId();
  const supabase = createAdminClient({ unscoped: true });
  await supabase
    .from("tenants")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", tenantId);
  revalidatePath("/admin", "layout");
  redirect("/admin/dashboard");
}
