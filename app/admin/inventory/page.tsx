import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { InventoryManager } from "./InventoryManager";
import { CategoriesPanel } from "./CategoriesPanel";
import { BulkUploadButton } from "@/components/admin/BulkUploadButton";
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
          <BulkUploadButton
            templateUrl="/api/templates/inventory"
            uploadAction={bulkUploadInventory}
            description="Bulk add operational gear from a CSV."
          />
        )}
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Operational gear (generators, blowers, anchors, supplies, vehicles, tools).
        For rental products (bounce houses, accessories), use the Products page.
      </p>

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
