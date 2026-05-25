import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { InventoryManager } from "./InventoryManager";
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

export default async function AdminInventoryPage() {
  // Staff or admin
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  const { data: items } = await supabase
    .from("inventory_items")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const list: InventoryItem[] = (items as InventoryItem[]) || [];

  // Build category list from existing items + a default suggestion list
  const SUGGESTED = [
    "Generators",
    "Blowers",
    "Cables & Power",
    "Anchors & Stakes",
    "Tarps",
    "Cleaning Supplies",
    "Spare Parts",
    "Tools",
    "Vehicles & Trailers",
    "Other",
  ];
  const usedCategories = Array.from(new Set(list.map((i) => i.category)));
  const allCategories = Array.from(new Set([...SUGGESTED, ...usedCategories])).sort();

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

      <InventoryManager
        items={list}
        categories={allCategories}
        isAdmin={me.role === "admin"}
      />
    </div>
  );
}
