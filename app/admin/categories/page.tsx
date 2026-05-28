import { createAdminClient } from "@/lib/supabase/admin";
import { CategoriesManager } from "./CategoriesManager";
import { SurfacesManager } from "./SurfacesManager";
import { BulkUploadButton } from "@/components/admin/BulkUploadButton";
import { bulkUploadCategories } from "../bulk-upload/actions";

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

interface Surface {
  id: string;
  value: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

export default async function AdminCategoriesPage() {
  const supabase = createAdminClient();

  // Get categories + count of products per category + setup surfaces
  const [{ data: categories }, { data: products }, { data: surfaces }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, description, display_order, is_active, image_url")
        .order("display_order"),
      supabase.from("products").select("category"),
      supabase
        .from("setup_surfaces")
        .select("id, value, label, display_order, is_active")
        .order("display_order"),
    ]);

  // Build per-category product counts
  const counts: Record<string, number> = {};
  for (const p of products || []) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-brand-navy">Categories</h1>
        <BulkUploadButton
          templateUrl="/api/templates/categories"
          uploadAction={bulkUploadCategories}
          description="Bulk add categories from a CSV."
        />
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Manage rental categories shown on the website. Active categories appear in
        navigation and home page. Inactive ones are hidden but kept for reference.
      </p>

      <section>
        <h2 className="text-xl font-bold text-brand-navy mb-1">Product categories</h2>
        <p className="text-sm text-slate-500 mb-4">
          Group your rental products (Bounce Houses, Tents, Tables, etc.).
        </p>
        <CategoriesManager
          categories={(categories as Category[]) || []}
          productCounts={counts}
        />
      </section>

      <SurfacesManager surfaces={(surfaces as Surface[]) || []} />
    </div>
  );
}
