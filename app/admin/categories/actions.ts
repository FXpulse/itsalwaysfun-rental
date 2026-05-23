"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

const CategoryInput = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "lowercase, numbers, hyphens only"),
  description: z.string().max(500).optional().nullable(),
  display_order: z.number().int().min(0).max(999),
  is_active: z.boolean(),
});

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const parsed = CategoryInput.safeParse({
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || "") || null,
    display_order: parseInt(String(formData.get("display_order") || "0"), 10),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return { error: "A category with that name or slug already exists." };
    return { error: error.message };
  }
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = CategoryInput.safeParse({
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || "") || null,
    display_order: parseInt(String(formData.get("display_order") || "0"), 10),
    is_active: formData.get("is_active") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.errors.map((e) => e.message).join(", ") };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  // Check if any products use this category
  const { data: cat } = await supabase.from("categories").select("name").eq("id", id).single();
  if (!cat) return { error: "Category not found" };

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category", cat.name);

  if ((count ?? 0) > 0) {
    return {
      error: `Cannot delete — ${count} product(s) still use "${cat.name}". Move them to another category first or set this one to Inactive.`,
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true };
}

export async function toggleCategoryActive(id: string, currentlyActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
  return { success: true };
}
