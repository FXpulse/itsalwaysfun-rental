// Fleet at a glance — todas las units físicas con su estado actual + historia.
// Vista nueva ERPNext-inspired (Asset Movement equivalent), 2026-06-16.

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrAdmin } from "@/lib/auth/roles";
import { UnitsFleetClient } from "./UnitsFleetClient";

export const dynamic = "force-dynamic";

export default async function UnitsFleetPage({
  searchParams,
}: { searchParams?: { state?: string } }) {
  await requireStaffOrAdmin();
  const supabase = createAdminClient();

  const stateFilter = searchParams?.state || "";

  let query = supabase
    .from("inventory_units")
    .select(`
      id, tag, serial_number, condition, current_state, current_booking_id,
      state_changed_at, is_active,
      inventory_item:inventory_items(id, name)
    `)
    .eq("is_active", true)
    .order("tag");

  if (stateFilter) {
    query = query.eq("current_state", stateFilter);
  }

  const { data: units } = await query;

  // Counts por estado para el filter strip
  const { data: allActive } = await supabase
    .from("inventory_units")
    .select("current_state")
    .eq("is_active", true);

  const stateCounts: Record<string, number> = {};
  for (const r of (allActive as any[]) || []) {
    stateCounts[r.current_state] = (stateCounts[r.current_state] || 0) + 1;
  }
  const totalActive = (allActive as any[])?.length || 0;

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fleet at a glance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Every tracked unit across all inventory items + their current state. Click a unit to see its movement history.
          </p>
        </div>
        <Link
          href="/admin/inventory"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Inventory items
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill href="/admin/inventory/units" label={`All`} count={totalActive} active={!stateFilter} />
        {(["warehouse","loading","on_truck","at_customer","returning","maintenance","retired"] as const).map((s) => (
          <FilterPill
            key={s}
            href={`/admin/inventory/units?state=${s}`}
            label={s.replace("_", " ")}
            count={stateCounts[s] || 0}
            active={stateFilter === s}
          />
        ))}
      </div>

      <UnitsFleetClient units={(units as any[]) || []} />
    </div>
  );
}

function FilterPill({ href, label, count, active }: { href: string; label: string; count: number; active: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium capitalize ${
        active
          ? "bg-brand-navy text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
      <span className={`text-xs ${active ? "text-white/80" : "text-slate-500"}`}>{count}</span>
    </Link>
  );
}
