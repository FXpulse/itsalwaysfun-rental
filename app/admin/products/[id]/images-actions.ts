"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { uploadImage, deleteImage } from "@/lib/storage/upload";

/** Upload an image file + add to product gallery */
export async function uploadProductGalleryImage(productId: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };

  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("slug, name")
    .eq("id", productId)
    .single();

  const upload = await uploadImage({
    bucket: "product-images",
    file,
    pathPrefix: `gallery/${product?.slug || productId}`,
    filenameHint: product?.slug || "product",
  });
  if ("error" in upload) return { error: upload.error };

  // Append at the end (highest sort_order + 10)
  const { data: maxRow } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order || 0) + 10;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: upload.url,
    storage_path: upload.path,
    alt_text: product?.name || null,
    sort_order: nextOrder,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/items", "layout");
  return { success: true, url: upload.url };
}

/** Add by URL (no upload — useful if image already hosted elsewhere) */
export async function addProductImageByUrl(productId: string, formData: FormData) {
  await requireAdmin();
  const url = String(formData.get("image_url") || "").trim();
  const altText = String(formData.get("alt_text") || "").trim() || null;
  if (!url || !/^https?:\/\//.test(url)) {
    return { error: "Valid http(s) URL required" };
  }
  const supabase = createAdminClient();
  const { data: maxRow } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order || 0) + 10;

  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: url,
    storage_path: null,
    alt_text: altText,
    sort_order: nextOrder,
    is_active: true,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/items", "layout");
  return { success: true };
}

export async function deleteProductImage(imageId: string, productId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .single();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { error: error.message };
  // Best-effort delete from storage if we own it
  if (img?.storage_path) {
    await deleteImage("product-images", img.storage_path);
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/items", "layout");
  return { success: true };
}

/** Move an image up/down in sort order by swapping with its neighbor */
export async function reorderProductImage(
  imageId: string,
  productId: string,
  direction: "up" | "down",
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: all } = await supabase
    .from("product_images")
    .select("id, sort_order")
    .eq("product_id", productId)
    .order("sort_order");
  if (!all || all.length < 2) return { success: true };
  const idx = all.findIndex((i: any) => i.id === imageId);
  if (idx === -1) return { error: "Image not found" };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return { success: true };
  const a = all[idx] as any;
  const b = all[swapIdx] as any;
  await supabase.from("product_images").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("product_images").update({ sort_order: a.sort_order }).eq("id", b.id);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/items", "layout");
  return { success: true };
}

/** Promote a gallery image to be the primary product image
 *  (updates products.image_url + keeps the gallery row). */
export async function setPrimaryProductImage(imageId: string, productId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("image_url")
    .eq("id", imageId)
    .single();
  if (!img) return { error: "Image not found" };
  const { error } = await supabase
    .from("products")
    .update({ image_url: img.image_url })
    .eq("id", productId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/items", "layout");
  revalidatePath("/");
  return { success: true };
}
