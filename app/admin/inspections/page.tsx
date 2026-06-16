// Inspection templates list — ERPNext-inspired Quality Inspection.
// Tenant define checklists once por product/category, después drivers o admins
// completan inspecciones contra esos templates desde el booking detail.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function InspectionTemplatesPage() {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  const { data: templates } = await supabase
    .from("inspection_templates")
    .select("id, name, product_id, category_id, items, is_active, updated_at, products(name), categories(name)")
    .order("is_active", { ascending: false })
    .order("name");

  const rows = (templates as any[]) || [];

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inspection Templates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pre/post-rental checklists. Drivers fill them out at delivery/pickup to document
            condition + catch issues before customer disputes.
          </p>
        </div>
        <Link
          href="/admin/inspections/new"
          className="rounded-md bg-brand-navy text-white px-4 py-2 font-medium hover:bg-brand-navy-dark"
        >
          + New template
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-600 mb-4">
            No templates yet. Create one per product type — e.g. "Bouncer delivery checklist" with items like
            "blower works", "stakes present", "clean", "no rips".
          </p>
          <Link
            href="/admin/inspections/new"
            className="inline-block rounded-md bg-brand-navy text-white px-4 py-2 font-medium"
          >
            Create your first template
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.map((t) => {
                const scope = t.products?.name
                  ? `Product: ${t.products.name}`
                  : t.categories?.name
                    ? `Category: ${t.categories.name}`
                    : "Global (all products)";
                const itemCount = Array.isArray(t.items) ? t.items.length : 0;
                return (
                  <tr key={t.id} className={t.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-slate-600">{scope}</td>
                    <td className="px-4 py-3 text-slate-600">{itemCount} items</td>
                    <td className="px-4 py-3">
                      {t.is_active ? (
                        <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">Archived</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/inspections/${t.id}`}
                        className="text-brand-navy hover:underline text-sm font-medium"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
