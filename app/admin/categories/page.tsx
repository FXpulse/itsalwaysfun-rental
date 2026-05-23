import { createAdminClient } from "@/lib/supabase/admin";
import { CategoriesManager } from "./CategoriesManager";

export const dynamic = "force-dynamic";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
}

export default async function AdminCategoriesPage() {
  const supabase = createAdminClient();

  // Get categories + count of products per category
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, display_order, is_active, image_url")
      .order("display_order"),
    supabase.from("products").select("category"),
  ]);

  // Build per-category product counts
  const counts: Record<string, number> = {};
  for (const p of products || []) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1">Categories</h1>
      <p className="text-sm text-slate-500 mb-6">
        Manage rental categories shown on the website. Active categories appear in
        navigation and home page. Inactive ones are hidden but kept for reference.
      </p>

      <CategoriesManager
        categories={(categories as Category[]) || []}
        productCounts={counts}
      />
    </div>
  );
}
