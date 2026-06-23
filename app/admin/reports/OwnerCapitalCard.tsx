// Owner-capital recovery view. Sits below the P&L card on /admin/reports.
//
// What it answers: "I (the owner) put money into the business — for fleet
// and as cash injections. How much has the business paid me back?"
//
// Accounting note: capital expenditures (fleet purchase) and owner
// contributions do NOT belong on the P&L (Income Statement). They live on
// the Balance Sheet as Assets ↔ Owner's Equity. We still show this here
// because most small-business owners care more about "did I get my money
// back?" than the formal accounting partition.
//
// Sources:
//   • Fleet cost  = sum(products.cost_cents) for active non-addon products
//   • Owner cash injections = sum(business_expenses.amount_cents)
//     WHERE category='owner_capital'
//   • Lifetime revenue = sum(bookings.total_amount) for paid+non-cancelled
//   • Lifetime net profit = revenue − all direct costs − all overhead −
//     all operating expenses (ever)
//
// Two views of recovery:
//   1. Naive: total revenue ever made (gross), how it compares to capital
//   2. Realistic: lifetime net profit (the cash that was actually
//      available to repay the owner), how it compares to capital

import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { Wallet, TrendingUp, AlertCircle, Banknote } from "lucide-react";

export async function OwnerCapitalCard() {
  const supabase = createAdminClient();

  // 1. Fleet investment (active non-addon products with a cost set)
  const { data: products } = await supabase
    .from("products")
    .select("cost_cents")
    .eq("is_active", true)
    .eq("is_addon", false);
  const fleet_cost_cents = ((products as any[]) || []).reduce(
    (s, p) => s + (p.cost_cents || 0),
    0,
  );

  // 2. Other owner contributions tracked as business expenses with
  //    category='owner_capital'
  const { data: ownerCashRows } = await supabase
    .from("business_expenses")
    .select("amount_cents")
    .eq("category", "owner_capital");
  const owner_cash_cents = ((ownerCashRows as any[]) || []).reduce(
    (s, r) => s + (r.amount_cents || 0),
    0,
  );

  // 3. Lifetime revenue (paid bookings, all time)
  const { data: paidBookings } = await supabase
    .from("bookings")
    .select("total_amount")
    .eq("stripe_payment_status", "paid")
    .neq("booking_status", "cancelled");
  const lifetime_revenue_cents = ((paidBookings as any[]) || []).reduce(
    (s, b) => s + (b.total_amount || 0),
    0,
  );

  // 4. Lifetime expenses (booking_expenses for paid bookings + ALL business
  //    expenses + accumulated overhead since first booking).
  //    A precise calc is heavy; the headline number that matters is
  //    "what's the business's running net profit." We approximate as:
  //      revenue − sum(booking_expenses linked to paid bookings)
  //              − sum(business_expenses NOT in owner_capital)
  //    Overhead is deliberately excluded from this because a recurring
  //    monthly cost is something the owner KEEPS paying for — it doesn't
  //    "consume" capital invested.
  const paidIds = ((paidBookings as any[]) || []).map((b: any) => b.id).filter(Boolean);
  let lifetime_direct_costs_cents = 0;
  if (paidIds.length > 0) {
    const { data: be } = await supabase
      .from("booking_expenses")
      .select("amount_cents")
      .in("booking_id", paidIds);
    lifetime_direct_costs_cents = ((be as any[]) || []).reduce(
      (s, e) => s + (e.amount_cents || 0),
      0,
    );
  }
  const { data: bizOps } = await supabase
    .from("business_expenses")
    .select("amount_cents")
    .neq("category", "owner_capital");
  const lifetime_operating_cents = ((bizOps as any[]) || []).reduce(
    (s, e) => s + (e.amount_cents || 0),
    0,
  );
  const lifetime_net_cents =
    lifetime_revenue_cents - lifetime_direct_costs_cents - lifetime_operating_cents;

  const total_invested_cents = fleet_cost_cents + owner_cash_cents;
  const outstanding_gross_cents = total_invested_cents - lifetime_revenue_cents;
  const outstanding_net_cents = total_invested_cents - Math.max(0, lifetime_net_cents);

  if (total_invested_cents === 0) {
    return null;
  }

  const recoveryPct =
    total_invested_cents > 0
      ? (Math.max(0, lifetime_net_cents) / total_invested_cents) * 100
      : 0;

  return (
    <div className="card border-l-4 border-l-violet-500 mb-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-navy mb-1 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-violet-600" /> Owner capital position
          </h2>
          <p className="text-xs text-slate-500 mb-1 max-w-prose">
            What the business owes you (the owner) right now. Tracks fleet
            purchases + any &quot;Owner capital&quot; transactions you logged in{" "}
            <code>/admin/expenses</code> against the cash the business has
            actually generated.
          </p>
          <p className="text-[11px] text-slate-400 italic mb-4">
            These figures aren&apos;t on the P&amp;L above because owner loans
            and capital expenditures live on the Balance Sheet, not the
            Income Statement. They still affect your real cash position.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <Stat
          label="Fleet invested"
          value={formatCurrency(fleet_cost_cents)}
          sub={`${((products as any[]) || []).filter((p: any) => (p.cost_cents || 0) > 0).length} products with cost set`}
          color="amber"
          icon={Banknote}
        />
        <Stat
          label="Owner cash injections"
          value={formatCurrency(owner_cash_cents)}
          sub={
            owner_cash_cents > 0
              ? "From owner_capital expenses"
              : "Nothing logged yet"
          }
          color="amber"
          icon={Banknote}
        />
        <Stat
          label="Lifetime net profit"
          value={formatCurrency(Math.max(0, lifetime_net_cents))}
          sub={
            lifetime_net_cents > 0
              ? "Cash available to repay owner"
              : `Currently running ${formatCurrency(lifetime_net_cents)} — no cash yet to repay`
          }
          color={lifetime_net_cents > 0 ? "emerald" : "amber"}
          icon={TrendingUp}
        />
        <Stat
          label="STILL OWED TO OWNER"
          value={formatCurrency(Math.max(0, outstanding_net_cents))}
          sub={`${recoveryPct.toFixed(0)}% recovered`}
          color={outstanding_net_cents <= 0 ? "emerald" : "rose"}
          big
          icon={AlertCircle}
        />
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-brand-navy font-medium">
          How this is calculated
        </summary>
        <div className="mt-2 bg-slate-50 rounded p-3 space-y-1 font-mono text-[11px]">
          <div className="flex justify-between"><span>Fleet invested</span><span>+{formatCurrency(fleet_cost_cents)}</span></div>
          <div className="flex justify-between"><span>+ Owner cash injections</span><span>+{formatCurrency(owner_cash_cents)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>= Total invested</span><span>{formatCurrency(total_invested_cents)}</span></div>
          <div className="h-2"></div>
          <div className="flex justify-between"><span>Lifetime revenue (paid bookings)</span><span>{formatCurrency(lifetime_revenue_cents)}</span></div>
          <div className="flex justify-between"><span>− Direct booking costs</span><span>-{formatCurrency(lifetime_direct_costs_cents)}</span></div>
          <div className="flex justify-between"><span>− Operating expenses (ex. owner capital)</span><span>-{formatCurrency(lifetime_operating_cents)}</span></div>
          <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>= Lifetime net profit</span><span>{formatCurrency(lifetime_net_cents)}</span></div>
          <div className="h-2"></div>
          <div className="flex justify-between font-bold text-rose-700"><span>STILL OWED TO OWNER = Invested − Net profit</span><span>{formatCurrency(Math.max(0, outstanding_net_cents))}</span></div>
          <div className="text-slate-400 mt-2 text-[10px] not-italic">
            ℹ Overhead is excluded from net profit here because recurring
            costs (rent, insurance, etc.) are what the business covers from
            ongoing revenue — they don&apos;t &quot;eat up&quot; the owner&apos;s
            capital injection.
          </div>
        </div>
      </details>
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
  color: "amber" | "emerald" | "rose";
  big?: boolean;
  icon?: any;
}) {
  const colorClass = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    rose: "bg-rose-50 border-rose-200 text-rose-900",
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
