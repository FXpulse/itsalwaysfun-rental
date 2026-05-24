"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/roles";
import { uploadImage } from "@/lib/storage/upload";
import { z } from "zod";

export async function uploadBanner(formData: FormData) {
  await requireAdmin();
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return { error: "No file selected" };

  const upload = await uploadImage({
    bucket: "site-assets",
    file,
    pathPrefix: "banners",
    filenameHint: "banner",
  });

  if ("error" in upload) return { error: upload.error };

  const supabase = createAdminClient();

  // Sort order = max + 1 so new banner appears at the end
  const { data: existing } = await supabase
    .from("home_banners")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (existing?.sort_order ?? -1) + 1;

  const altText = (formData.get("alt_text") as string) || "";
  const linkUrl = (formData.get("link_url") as string) || "";

  const { error } = await supabase.from("home_banners").insert({
    image_url: upload.url,
    alt_text: altText || null,
    link_url: linkUrl || null,
    sort_order: nextOrder,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { success: true, url: upload.url };
}

const UpdateSchema = z.object({
  alt_text: z.string().max(500).nullable(),
  link_url: z.string().max(500).nullable(),
});

export async function updateBanner(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = UpdateSchema.safeParse({
    alt_text: ((formData.get("alt_text") as string) || "").trim() || null,
    link_url: ((formData.get("link_url") as string) || "").trim() || null,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("home_banners")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function toggleBannerActive(id: string, currentlyActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("home_banners")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteBanner(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("home_banners").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function reorderBanner(id: string, direction: "up" | "down") {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: all } = await supabase
    .from("home_banners")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  if (!all || all.length < 2) return { success: true };

  const idx = all.findIndex((b: any) => b.id === id);
  if (idx === -1) return { error: "Banner not found" };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return { success: true };

  const a = all[idx] as any;
  const b = all[swapIdx] as any;

  // Swap sort_orders
  await supabase
    .from("home_banners")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  await supabase
    .from("home_banners")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);

  revalidatePath("/admin/banners");
  revalidatePath("/", "layout");
  return { success: true };
}
