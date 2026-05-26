// P&L summary card for the reports page. Server component.

import { computePnL } from "@/lib/accounting";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Receipt, Calculator } from "lucide-react";

// Booking expense categories are fixed in code (they're operational, not
// accounting). Overhead categories are dynamic — fetched at render time.
const BOOKING_EXPENSE_LABELS: Record<string, string> = {
  gas: "⛽ Gas",
  payroll: "👥 Payroll",
  tolls: "🛣 Tolls",
  consumables: "📦 Consumables",
  damage_repair: "🔧 Damage repair",
  permit_fee: "📋 Permits",
  other: "🗂 Other",
};

export async function PnLCard({ from, to }: { from: string; to: string }) {
  const supabase = createAdminClient();
  const [pnl, { data: overheadCats }] = await Promise.all([
    computePnL(from, to),
    supabase.from("overhead_categories").select("key, label"),
  ]);
  const overheadLabelByKey = new Map<string, string>(
    ((overheadCats as { key: string; label: string }[]) || []).map((c) => [c.key, c.label]),
  );
  const labelFor = (cat: string, scope: "expense" | "overhead") => {
    if (scope === "expense") return BOOKING_EXPENSE_LABELS[cat] || cat;
    return overheadLabelByKey.get(cat) || cat;
  };
  const isProfit = pnl.net_profit_cents > 0;

  return (
    <div className="card border-l-4 border-l-brand-yellow mb-6">
      <h2 className="text-lg font-bold text-brand-navy mb-1 flex items-center gap-2">
        <Calculator className="h-5 w-5" /> Profit &amp; Loss
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Real margin = Revenue − Direct booking costs − Allocated overhead. Based on
        PAID bookings with event_date in this period.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
        <Stat
          label="Revenue"
          value={formatCurrency(pnl.revenue_cents)}
          sub={`${pnl.bookings_count} booking${pnl.bookings_count === 1 ? "" : "s"}`}
          color="green"
        />
        <Stat
          label="Direct costs"
          value={`-${formatCurrency(pnl.direct_costs_cents)}`}
          sub="gas, payroll, etc."
          color="red"
        />
        <Stat
          label="Gross profit"
          value={formatCurrency(pnl.gross_profit_cents)}
          sub={`${
            pnl.revenue_cents > 0
              ? ((pnl.gross_profit_cents / pnl.revenue_cents) * 100).toFixed(0)
              : 0
          }% margin`}
          color={pnl.gross_profit_cents > 0 ? "blue" : "amber"}
        />
        <Stat
          label="Overhead alloc."
          value={`-${formatCurrency(pnl.overhead_allocated_cents)}`}
          sub="rent, insurance, etc."
          color="red"
        />
        <Stat
          label="NET PROFIT"
          value={formatCurrency(pnl.net_profit_cents)}
          sub={`${(pnl.margin_pct * 100).toFixed(0)}% net margin`}
          color={isProfit ? "emerald" : "amber"}
          big
          icon={isProfit ? TrendingUp : TrendingDown}
        />
      </div>

      {(Object.keys(pnl.expenses_by_category).length > 0 ||
        Object.keys(pnl.overhead_by_category).length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 border-t pt-4">
          {Object.keys(pnl.expenses_by_category).length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 inline-flex items-center gap-1">
                <Receipt className="h-3 w-3" /> Direct costs breakdown
              </h3>
              <ul className="space-y-1">
                {Object.entries(pnl.expenses_by_category)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <li key={cat} className="flex justify-between text-xs">
                      <span>{labelFor(cat, "expense")}</span>
                      <span className="font-mono text-red-700">
                        -{formatCurrency(amount)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {Object.keys(pnl.overhead_by_category).length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 inline-flex items-center gap-1">
                <Calculator className="h-3 w-3" /> Allocated overhead breakdown
              </h3>
              <ul className="space-y-1">
                {Object.entries(pnl.overhead_by_category)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <li key={cat} className="flex justify-between text-xs">
                      <span>{labelFor(cat, "overhead")}</span>
                      <span className="font-mono text-red-700">
                        -{formatCurrency(amount)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {pnl.bookings_count === 0 && (
        <div className="text-center text-xs text-slate-400 py-4">
          No paid bookings in this period. Adjust the date range or record some bookings.
        </div>
      )}

      {pnl.bookings_count > 0 &&
        pnl.direct_costs_cents === 0 &&
        pnl.overhead_allocated_cents === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900">
            ⚠ No costs tracked yet — net profit shows 100%. Record expenses on each
            booking detail page + add monthly overhead in <code>/admin/overhead</code> to see real margins.
          </div>
        )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
  big = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: "green" | "red" | "blue" | "amber" | "emerald";
  big?: boolean;
  icon?: any;
}) {
  const colorClass = {
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  }[color];
  return (
    <div
      className={`rounded p-3 border ${colorClass} ${
        big ? "ring-2 ring-offset-1 ring-current" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-70 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={`font-mono font-bold ${big ? "text-xl" : "text-base"}`}>
        {value}
      </div>
      <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>
    </div>
  );
}
