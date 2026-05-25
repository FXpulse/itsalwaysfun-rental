"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { uploadImage } from "@/lib/storage/upload";
import { z } from "zod";

const ReviewSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_location: z.string().max(200).optional().nullable(),
  review_text: z.string().min(10).max(3000),
  rating: z.number().int().min(1).max(5),
  photo_url: z.string().url().optional().nullable(),
  source: z.enum(["google", "facebook", "manual", "yelp", "instagram", "email"]),
  source_url: z.string().url().optional().nullable(),
  is_featured: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
  reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

function parseForm(formData: FormData) {
  const str = (k: string) => (String(formData.get(k) || "").trim() || null);
  const intVal = (k: string, def: number) => {
    const v = parseInt(String(formData.get(k) || ""), 10);
    return Number.isNaN(v) ? def : v;
  };
  return {
    customer_name: String(formData.get("customer_name") || "").trim(),
    customer_location: str("customer_location"),
    review_text: String(formData.get("review_text") || "").trim(),
    rating: intVal("rating", 5),
    photo_url: str("photo_url"),
    source: (String(formData.get("source") || "manual") as any),
    source_url: str("source_url"),
    is_featured: formData.get("is_featured") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: intVal("sort_order", 100),
    reviewed_at: str("reviewed_at"),
  };
}

export async function createReview(formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = ReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("customer_reviews").insert(parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  revalidatePath("/reviews");
  return { success: true };
}

export async function updateReview(id: string, formData: FormData) {
  await requireAdmin();
  const raw = parseForm(formData);
  const parsed = ReviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customer_reviews")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  revalidatePath("/reviews");
  return { success: true };
}

export async function deleteReview(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("customer_reviews").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  revalidatePath("/reviews");
  return { success: true };
}

export async function toggleFeatured(id: string, featured: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customer_reviews")
    .update({ is_featured: featured })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { success: true };
}

export async function toggleActive(id: string, active: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customer_reviews")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  revalidatePath("/reviews");
  return { success: true };
}

/** Upload an optional photo for a review (customer's family photo, event pic, etc.) */
export async function uploadReviewPhoto(formData: FormData) {
  await requireAdmin();
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };
  const upload = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: "reviews",
    filenameHint: "review",
  });
  if ("error" in upload) return { error: upload.error };
  return { success: true, url: upload.url };
}
