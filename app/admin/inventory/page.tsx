import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { InventoryManager } from "./InventoryManager";
import { CategoriesPanel } from "./CategoriesPanel";
import { BulkUploadButton } from "@/components/admin/BulkUploadButton";
import { ExportCsvButton } from "@/components/admin/ExportCsvButton";
import { bulkUploadInventory } from "../bulk-upload/actions";

export const dynamic = "force-dynamic";

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  quantity_owned: number;
  quantity_in_use: number;
  location: string | null;
  condition: "good" | "needs_repair" | "broken" | "retired";
  purchase_date: string | null;
  purchase_cost_cents: number;
  last_maintenance_date: string | null;
  maintenance_notes: string | null;
  notes: string | null;
  is_active: boolean;
  low_stock_threshold: number;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export default async function AdminInventoryPage() {
  // Staff or admin
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  const [itemsRes, catsRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("inventory_categories")
      .select("id, name, description, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const list: InventoryItem[] = (itemsRes.data as InventoryItem[]) || [];
  const dbCategories: InventoryCategory[] = (catsRes.data as InventoryCategory[]) || [];

  // Count items per category name (for the management panel)
  const itemCountByCategory = new Map<string, number>();
  for (const i of list) {
    itemCountByCategory.set(i.category, (itemCountByCategory.get(i.category) || 0) + 1);
  }

  // Build dropdown list: active DB categories + any orphan strings still on items
  const activeDbNames = dbCategories.filter((c) => c.is_active).map((c) => c.name);
  const usedCategories = Array.from(new Set(list.map((i) => i.category)));
  const allCategories = Array.from(new Set([...activeDbNames, ...usedCategories])).sort();

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-brand-navy">Inventory</h1>
        {me.role === "admin" && (
          <div className="flex gap-2">
            <ExportCsvButton entity="inventory" />
            <BulkUploadButton
              templateUrl="/api/templates/inventory"
              uploadAction={bulkUploadInventory}
              description="Bulk add operational gear from a CSV."
            />
          </div>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Operational gear (generators, blowers, anchors, supplies, vehicles, tools).
        For rental products (bounce houses, accessories), use the Products page.
      </p>

      {(() => {
        const lowStock = list.filter(
          (i) =>
            i.is_active &&
            i.low_stock_threshold > 0 &&
            i.quantity_owned - i.quantity_in_use <= i.low_stock_threshold,
        );
        if (lowStock.length === 0) return null;
        return (
          <div className="bg-amber-50 border-l-4 border-amber-400 rounded p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-amber-900 text-sm mb-1">
                  ⚠ {lowStock.length} item{lowStock.length === 1 ? "" : "s"} at or below low-stock threshold
                </div>
                <ul className="text-xs text-amber-900 space-y-0.5">
                  {lowStock.slice(0, 10).map((i) => {
                    const avail = i.quantity_owned - i.quantity_in_use;
                    return (
                      <li key={i.id}>
                        <strong>{i.name}</strong>{" "}
                        <span className="text-amber-700">({i.category})</span>:{" "}
                        <span className="font-mono">
                          {avail} available / {i.quantity_owned} owned
                        </span>{" "}
                        <span className="text-amber-600">
                          · threshold ≤ {i.low_stock_threshold}
                        </span>
                      </li>
                    );
                  })}
                  {lowStock.length > 10 && (
                    <li className="italic text-amber-700">
                      ...and {lowStock.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        );
      })()}

      {me.role === "admin" && (
        <CategoriesPanel
          categories={dbCategories}
          itemCounts={Object.fromEntries(itemCountByCategory)}
        />
      )}

      <InventoryManager
        items={list}
        categories={allCategories}
        isAdmin={me.role === "admin"}
      />
    </div>
  );
}
