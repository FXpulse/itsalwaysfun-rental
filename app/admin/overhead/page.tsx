import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { Calculator } from "lucide-react";
import { OverheadManager } from "./OverheadManager";
import { getTenantInfo } from "@/lib/tenant/business";

export const dynamic = "force-dynamic";

export interface OverheadRow {
  id: string;
  name: string;
  category: string;
  monthly_cents: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export interface CategoryRow {
  key: string;
  label: string;
  group_name: string | null;
  sort_order: number;
  is_active: boolean;
}

export default async function AdminOverheadPage() {
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const tenant = await getTenantInfo();
  const tz = tenant.timezone;
  const [{ data: rows }, { data: cats }] = await Promise.all([
    supabase
      .from("overhead_costs")
      .select("*")
      .order("effective_to", { ascending: true, nullsFirst: true })
      .order("category")
      .order("name"),
    supabase
      .from("overhead_categories")
      .select("key, label, group_name, sort_order, is_active")
      .order("sort_order")
      .order("label"),
  ]);

  const list = (rows as OverheadRow[]) || [];
  const categories = (cats as CategoryRow[]) || [];
  const active = list.filter((r) => !r.effective_to);
  const monthlyTotal = active.reduce((sum, r) => sum + r.monthly_cents, 0);
  const annualTotal = monthlyTotal * 12;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Calculator className="h-6 w-6" /> Monthly Overhead
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Fixed monthly costs (rent, insurance, software, utilities) that get
        ALLOCATED across all bookings in a period to compute true profit margin.
        Different from per-booking expenses (gas, payroll) — those are tracked
        on each booking's detail page.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card py-3 bg-amber-50 border-amber-200">
          <div className="text-xs text-slate-500 uppercase">Active overhead</div>
          <div className="text-xl font-bold text-brand-navy mt-1">
            {formatCurrency(monthlyTotal)}<span className="text-sm text-slate-500">/mo</span>
          </div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Annualized</div>
          <div className="text-xl font-bold text-brand-navy mt-1">
            {formatCurrency(annualTotal)}<span className="text-sm text-slate-500">/yr</span>
          </div>
        </div>
        <div className="card py-3">
          <div className="text-xs text-slate-500 uppercase">Line items</div>
          <div className="text-xl font-bold text-brand-navy mt-1">
            {active.length} active
            <span className="text-xs text-slate-500 ml-1">
              ({list.length - active.length} ended)
            </span>
          </div>
        </div>
      </div>

      <OverheadManager rows={list} categories={categories} tz={tz} />

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
        💡 <strong>How allocation works:</strong> in the P&L report, monthly
        overhead gets divided by the number of bookings completed that month.
        So if you have $4,000/mo overhead and 40 bookings → $100 overhead
        allocated to each booking. Set <strong>"Effective from"</strong>{" "}
        accurately so historical reports compute correctly when you raise/lower
        costs over time.
      </div>
    </div>
  );
}
