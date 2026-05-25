import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Package, Wrench } from "lucide-react";
import { MaintenanceLog } from "./MaintenanceLog";
import { UnitsPanel, type UnitRow } from "./UnitsPanel";

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
  const [{ data: item }, { data: history }, { data: allUnits }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("id", params.id).single(),
    supabase
      .from("inventory_maintenance")
      .select("*")
      .eq("inventory_item_id", params.id)
      .order("performed_at", { ascending: false }),
    supabase
      .from("inventory_units")
      .select("id, tag, serial_number, condition, notes, acquired_date, retired_at, is_active")
      .eq("inventory_item_id", params.id)
      .order("tag"),
  ]);

  if (!item) notFound();

  // Build current-assignment map: { unit_id → { route_id, route_date } | null }
  const unitIds = ((allUnits as any[]) || []).map((u) => u.id);
  const { data: activeAssignments } = unitIds.length
    ? await supabase
        .from("dispatch_route_units")
        .select("unit_id, route_id, dispatch_routes ( route_date )")
        .is("returned_at", null)
        .in("unit_id", unitIds)
    : { data: [] };
  const assignmentMap = new Map<string, { route_id: string; route_date: string }>();
  for (const a of (activeAssignments as any[]) || []) {
    assignmentMap.set(a.unit_id, {
      route_id: a.route_id,
      route_date: a.dispatch_routes?.route_date,
    });
  }

  const units: UnitRow[] = ((allUnits as any[]) || []).map((u) => {
    const assign = assignmentMap.get(u.id);
    return {
      ...u,
      current_route_id: assign?.route_id || null,
      current_route_date: assign?.route_date || null,
    };
  });

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

      {/* Per-unit tracking (admin only) */}
      {me.role === "admin" && (
        <UnitsPanel
          itemId={item.id}
          itemName={item.name}
          tracksUnits={item.tracks_units || false}
          prefixSuggestion={
            (item.unit_tag_prefix as string) ||
            item.name
              .split(/\s+/)
              .map((w: string) => w[0]?.toUpperCase() || "")
              .join("")
              .slice(0, 4) ||
            "ITEM"
          }
          units={units}
        />
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
