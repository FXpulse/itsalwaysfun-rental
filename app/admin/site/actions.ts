"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage/upload";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/** Update a batch of site settings from a FormData. */
export async function updateSiteSettings(formData: FormData) {
  const user = await requireAdmin();
  const supabase = createAdminClient();

  // Convert FormData → array of {key, value}
  const updates: { key: string; value: string }[] = [];
  formData.forEach((value, key) => {
    if (typeof value === "string") {
      updates.push({ key, value });
    }
  });

  if (updates.length === 0) {
    return { error: "No fields to update" };
  }

  // Upsert each
  for (const u of updates) {
    const { error } = await supabase
      .from("site_settings")
      .update({ value: u.value, updated_by: user.email })
      .eq("key", u.key);
    if (error) {
      return { error: `Failed to update ${u.key}: ${error.message}` };
    }
  }

  revalidatePath("/admin/site");
  revalidatePath("/", "layout"); // bust public pages
  return { success: true };
}

/** Upload logo and update site_settings.logo_url. */
export async function uploadLogo(formData: FormData) {
  await requireAdmin();
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  const upload = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: "logos",
    filenameHint: "logo",
  });

  if ("error" in upload) {
    return { error: upload.error };
  }

  // Save URL to site_settings
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .update({ value: upload.url })
    .eq("key", "logo_url");

  if (error) {
    return { error: `Saved upload but failed to update settings: ${error.message}` };
  }

  revalidatePath("/admin/site");
  revalidatePath("/", "layout");
  return { success: true, url: upload.url };
}

/** Upload product image and update products.image_url. */
export async function uploadProductImage(productId: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  // Look up product slug for naming
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .single();

  const upload = await uploadImage({
    bucket: "product-images",
    file,
    pathPrefix: "products",
    filenameHint: product?.slug || "product",
  });

  if ("error" in upload) {
    return { error: upload.error };
  }

  const { error } = await supabase
    .from("products")
    .update({ image_url: upload.url })
    .eq("id", productId);

  if (error) {
    return { error: `Uploaded but failed to save: ${error.message}` };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/", "layout");
  return { success: true, url: upload.url };
}
