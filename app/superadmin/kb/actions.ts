"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSuperadminUser } from "@/lib/auth/superadmin";

async function requireAuth() {
  const user = await getSuperadminUser();
  if (!user) throw new Error("Unauthorized");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export interface ArticleInput {
  slug: string;
  title: string;
  body_md: string;
  category: string;
  tags: string;     // comma-separated for the form
  is_published: boolean;
}

export async function createArticle(input: ArticleInput) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  const finalSlug = input.slug.trim() || slugify(input.title);
  const tags = input.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const { error, data } = await supabase
    .from("kb_articles")
    .insert({
      slug: finalSlug,
      title: input.title.trim(),
      body_md: input.body_md,
      category: input.category.trim() || null,
      tags,
      is_published: input.is_published,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/superadmin/kb");
  redirect(`/superadmin/kb/${data?.id}/edit`);
}

export async function updateArticle(id: string, input: ArticleInput) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  const tags = input.tags.split(",").map((t) => t.trim()).filter(Boolean);
  const { error } = await supabase
    .from("kb_articles")
    .update({
      slug: input.slug,
      title: input.title.trim(),
      body_md: input.body_md,
      category: input.category.trim() || null,
      tags,
      is_published: input.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/superadmin/kb");
  revalidatePath(`/superadmin/kb/${id}/edit`);
  return { success: true };
}

export async function deleteArticle(id: string) {
  await requireAuth();
  const supabase = createAdminClient({ unscoped: true });
  await supabase.from("kb_articles").delete().eq("id", id);
  revalidatePath("/superadmin/kb");
  redirect("/superadmin/kb");
}
