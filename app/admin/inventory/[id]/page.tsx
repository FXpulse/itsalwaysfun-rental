import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Package, Wrench } from "lucide-react";
import { MaintenanceLog } from "./MaintenanceLog";

export const dynamic = "force-dynamic";

const TYPE_STYLES: Record<string, string> = {
  cleaning: "bg-blue-100 text-blue-800",
  repair: "bg-orange-100 text-orange-800",
  inspection: "bg-purple-100 text-purple-800",
  replacement: "bg-red-100 text-red-800",
  other: "bg-slate-100 text-slate-700",
};

export default async function InventoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const me = await getCurrentUserRole();
  if (!me) redirect("/admin/login");

  const supabase = createAdminClient();
  const [{ data: item }, { data: history }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("id", params.id).single(),
    supabase
      .from("inventory_maintenance")
      .select("*")
      .eq("inventory_item_id", params.id)
      .order("performed_at", { ascending: false }),
  ]);

  if (!item) notFound();

  const entries = (history as any[]) || [];
  const totalSpent = entries.reduce((s, e) => s + (e.cost_cents || 0), 0);
  const byType = entries.reduce((acc: Record<string, number>, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/inventory"
        className="text-sm text-slate-500 hover:text-brand-navy inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> Back to inventory
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy flex items-center gap-2">
            <Package className="h-5 w-5" /> {item.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{item.category}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Stock</div>
          <div className="font-bold text-brand-navy">
            {item.quantity_owned - item.quantity_in_use} / {item.quantity_owned}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Condition</div>
          <div className="font-bold text-brand-navy capitalize">
            {item.condition.replace("_", " ")}
          </div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Maintenance entries</div>
          <div className="font-bold text-brand-navy">{entries.length}</div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Total spent on maintenance</div>
          <div className="font-bold text-brand-navy">{formatCurrency(totalSpent)}</div>
        </div>
      </div>

      {item.purchase_cost_cents > 0 && (
        <div className="card mb-6 bg-slate-50">
          <div className="text-xs text-slate-500 uppercase mb-1">Purchase info</div>
          <div className="text-sm">
            {formatCurrency(item.purchase_cost_cents)}
            {item.purchase_date && (
              <span className="text-slate-500 ml-2">
                acquired {new Date(item.purchase_date).toLocaleDateString()}
              </span>
            )}
            {totalSpent > 0 && (
              <span className="text-slate-500 ml-2">
                · spent {formatCurrency(totalSpent)} on maintenance (
                {((totalSpent / item.purchase_cost_cents) * 100).toFixed(0)}% of cost)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Maintenance log */}
      <MaintenanceLog
        itemId={item.id}
        itemName={item.name}
        entries={entries}
        typeStyles={TYPE_STYLES}
      />
    </div>
  );
}
