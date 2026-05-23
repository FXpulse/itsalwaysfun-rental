import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { Plus, Edit, Calendar, Eye, EyeOff } from "lucide-react";
import type { Product } from "@/types/database";
import { ProductActiveToggle } from "./ProductActiveToggle";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return <div className="card text-red-600">Error loading products: {error.message}</div>;
  }

  const grouped: Record<string, Product[]> = {};
  for (const p of (products as Product[]) || []) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy mb-1">Products</h1>
          <p className="text-sm text-slate-500">
            {products?.length || 0} total products · manage inventory + pricing
          </p>
        </div>
        <Link href="/admin/products/new" className="btn-accent inline-flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add product
        </Link>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-8">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-3">
            {category} <span className="text-slate-400">({items.length})</span>
          </h2>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Price/day</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Stock</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(p.price_per_day)}</td>
                    <td className="px-4 py-3">{p.stock}</td>
                    <td className="px-4 py-3">
                      <ProductActiveToggle id={p.id} isActive={p.is_active} />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="inline-flex items-center gap-1 text-brand-navy hover:underline text-sm"
                      >
                        <Edit className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <Link
                        href={`/admin/availability?product=${p.id}`}
                        className="inline-flex items-center gap-1 text-slate-600 hover:underline text-sm"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Availability
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
