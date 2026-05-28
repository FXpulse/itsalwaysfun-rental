"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { z } from "zod";

const PackageItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  name: z.string().min(1).max(200),
});

const PackageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, hyphens"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  image_url: z.string().url().or(z.literal("")).optional().nullable(),
  price_cents: z.number().int().min(0),
  items: z.array(PackageItemSchema).min(1),
  display_order: z.number().int().default(0),
  is_active: z.boolean(),
});

function parseForm(formData: FormData) {
  const itemsRaw = formData.get("items") as string;
  let items: any[] = [];
  try {
    items = itemsRaw ? JSON.parse(itemsRaw) : [];
  } catch {}

  return {
    slug: String(formData.get("slug") || "").trim().toLowerCase(),
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "") || null,
    image_url: String(formData.get("image_url") || "") || null,
    price_cents: Math.round(parseFloat(String(formData.get("price_dollars") || "0")) * 100),
    items,
    display_order: parseInt(String(formData.get("display_order") || "0"), 10) || 0,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createPackage(formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = PackageSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("packages").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return { error: "Slug already exists" };
    return { error: error.message };
  }
  revalidatePath("/admin/packages");
  return { success: true };
}

export async function updatePackage(id: string, formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = PackageSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("packages").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/packages");
  revalidatePath(`/admin/packages/${id}`);
  return { success: true };
}

export async function deletePackage(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  // Check if any bookings reference this package
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("package_id", id);
  if ((count ?? 0) > 0) {
    return { error: "Can't delete — bookings reference this package. Set inactive instead." };
  }
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/packages");
  return { success: true };
}

/** Global on/off for the whole Packages section on the public site.
 *  Stored in site_settings.packages_section_enabled. Default = enabled. */
export async function setPackagesSectionEnabled(enabled: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "packages_section_enabled", value: enabled ? "true" : "false" },
      { onConflict: "tenant_id,key" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/packages");
  revalidatePath("/packages");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function togglePackageActive(id: string, currentlyActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("packages")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/packages");
  return { success: true };
}
