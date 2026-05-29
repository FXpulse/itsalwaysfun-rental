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
      let cleaned = value;
      // Auto-extract content="..." for verification meta tags so admins can
      // paste the whole <meta ... /> snippet they copied from Google/Bing.
      if (key === "seo_google_verification" || key === "seo_bing_verification") {
        const m = value.match(/content=["']([^"']+)["']/i);
        if (m) cleaned = m[1]!;
      }
      updates.push({ key, value: cleaned });
    }
  });

  if (updates.length === 0) {
    return { error: "No fields to update" };
  }

  // Upsert each (insert if missing, update if exists)
  for (const u of updates) {
    const { error } = await supabase
      .from("site_settings")
      .upsert(
        { key: u.key, value: u.value, updated_by: user.email },
        { onConflict: "tenant_id,key" },
      );
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

/** Upload a custom font file (.woff2/.woff/.ttf/.otf) to public storage.
 *  Saves the URL into site_settings.site_font_self_hosted_url so the public
 *  layout auto-emits an @font-face rule. The picker should also set
 *  site_font_family separately. */
export async function uploadCustomFont(formData: FormData) {
  const user = await requireAdmin();
  const file = formData.get("font") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  // Extension sanity check (some browsers report MIME as application/octet-stream)
  const lowerName = file.name.toLowerCase();
  const okExt =
    lowerName.endsWith(".woff2") ||
    lowerName.endsWith(".woff") ||
    lowerName.endsWith(".ttf") ||
    lowerName.endsWith(".otf");
  if (!okExt) {
    return { error: "Font file must be .woff2, .woff, .ttf, or .otf" };
  }

  const upload = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: "fonts",
    filenameHint: lowerName.replace(/\.[^.]+$/, "").slice(0, 60),
  });
  if ("error" in upload) return { error: upload.error };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "site_font_self_hosted_url", value: upload.url, updated_by: user.email },
      { onConflict: "tenant_id,key" },
    );
  if (error) {
    return { error: `Uploaded but failed to save URL: ${error.message}` };
  }

  revalidatePath("/admin/site");
  revalidatePath("/", "layout");
  return { success: true, url: upload.url };
}

/** Clear the self-hosted font URL (returns to Google Fonts or system default). */
export async function clearCustomFont() {
  const user = await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "site_font_self_hosted_url", value: "", updated_by: user.email },
      { onConflict: "tenant_id,key" },
    );
  if (error) return { error: error.message };
  revalidatePath("/admin/site");
  revalidatePath("/", "layout");
  return { success: true };
}

/** Upload an image for a package (cover image shown on /packages page).
 *  Returns the public URL — caller persists it to packages.image_url. */
export async function uploadPackageImage(formData: FormData): Promise<
  { success: true; url: string } | { error: string }
> {
  await requireAdmin();
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }
  const hint = String(formData.get("filename_hint") || "package").trim();
  const upload = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: "packages",
    filenameHint: hint || "package",
  });
  if ("error" in upload) return { error: upload.error };
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
