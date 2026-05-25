"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProductInputSchema } from "@/lib/validation";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function createProduct(formData: FormData) {
  await requireAdmin();

  const raw = {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || "") || null,
    category: String(formData.get("category") || ""),
    price_per_day: parseInt(String(formData.get("price_per_day_dollars") || "0"), 10) * 100,
    stock: parseInt(String(formData.get("stock") || "1"), 10),
    image_url: String(formData.get("image_url") || "") || null,
    ghl_listing_id: String(formData.get("ghl_listing_id") || "") || null,
    is_active: formData.get("is_active") === "on",
    setup_area: String(formData.get("setup_area") || "") || null,
    actual_size: String(formData.get("actual_size") || "") || null,
    outlets_required: parseInt(String(formData.get("outlets_required") || "1"), 10),
    age_group: String(formData.get("age_group") || "") || null,
    is_addon: formData.get("is_addon") === "on",
    cost_cents: Math.round(parseFloat(String(formData.get("cost_dollars") || "0")) * 100),
  };

  const parsed = ProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("products").insert(parsed.data);
  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();

  const raw = {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || "") || null,
    category: String(formData.get("category") || ""),
    price_per_day: parseInt(String(formData.get("price_per_day_dollars") || "0"), 10) * 100,
    stock: parseInt(String(formData.get("stock") || "1"), 10),
    image_url: String(formData.get("image_url") || "") || null,
    ghl_listing_id: String(formData.get("ghl_listing_id") || "") || null,
    is_active: formData.get("is_active") === "on",
    setup_area: String(formData.get("setup_area") || "") || null,
    actual_size: String(formData.get("actual_size") || "") || null,
    outlets_required: parseInt(String(formData.get("outlets_required") || "1"), 10),
    age_group: String(formData.get("age_group") || "") || null,
    is_addon: formData.get("is_addon") === "on",
    cost_cents: Math.round(parseFloat(String(formData.get("cost_dollars") || "0")) * 100),
  };

  const parsed = ProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("products").update(parsed.data).eq("id", id);
  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  redirect("/admin/products");
}

export async function toggleProductActive(id: string, currentlyActive: boolean) {
  await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
}

export async function deleteProduct(id: string) {
  await requireAdmin();

  const supabase = createAdminClient();
  // Check if there are bookings (cannot delete if referenced)
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  if ((count ?? 0) > 0) {
    return { error: "Cannot delete — this product has existing bookings. Set it inactive instead." };
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/products");
  return { success: true };
}
