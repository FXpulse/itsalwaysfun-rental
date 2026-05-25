import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductForm } from "../ProductForm";
import { ProductImageUploader } from "./ProductImageUploader";
import { InventoryRequirements } from "./InventoryRequirements";
import { updateProduct } from "../actions";
import type { Product } from "@/types/database";
import { z } from "zod";

const IdSchema = z.string().uuid();

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const idParse = IdSchema.safeParse(params.id);
  if (!idParse.success) notFound();

  const supabase = createAdminClient();
  const [
    { data: product, error },
    { data: categories },
    { data: inventory },
    { data: reqs },
    { data: otherProducts },
  ] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).single(),
    supabase.from("categories").select("name").eq("is_active", true).order("display_order"),
    supabase
      .from("inventory_items")
      .select("id, name, category")
      .eq("is_active", true)
      .order("category")
      .order("name"),
    supabase
      .from("product_inventory_requirements")
      .select(`
        id, inventory_item_id, quantity, surface_types, only_when_needs_power, notes,
        inventory_items (name, category)
      `)
      .eq("product_id", params.id),
    supabase
      .from("products")
      .select("id, name")
      .neq("id", params.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (error || !product) notFound();

  const requirements = ((reqs as any[]) || []).map((r) => ({
    id: r.id,
    inventory_item_id: r.inventory_item_id,
    inventory_name: r.inventory_items?.name || "(removed)",
    inventory_category: r.inventory_items?.category || "—",
    quantity: r.quantity,
    surface_types: r.surface_types,
    only_when_needs_power: r.only_when_needs_power,
    notes: r.notes,
  }));

  // Bind product ID to update action
  const boundUpdate = updateProduct.bind(null, product.id);

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-navy mb-4"
      >
        <ChevronLeft className="h-4 w-4" /> Back to products
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy mb-1">Edit product</h1>
      <p className="text-sm text-slate-500 mb-6">
        Slug: <code className="font-mono">{product.slug}</code>
      </p>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-brand-navy mb-1">Product image</h2>
        <p className="text-xs text-slate-500 mb-4">
          Upload a new image to replace the current one. The image is stored
          in Supabase Storage and the URL is saved automatically.
        </p>
        <ProductImageUploader
          productId={product.id}
          currentUrl={product.image_url}
        />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-brand-navy mb-4">Details</h2>
        <ProductForm
          product={product as Product}
          action={boundUpdate}
          submitLabel="Save"
          categories={categories || []}
        />
      </div>

      <InventoryRequirements
        productId={product.id}
        inventory={(inventory as any[]) || []}
        requirements={requirements}
        otherProducts={(otherProducts as any[]) || []}
      />
    </div>
  );
}
