import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { formatCurrency } from "@/lib/utils";
import { DateRangeForm } from "./DateRangeForm";
import { PnLCard } from "./PnLCard";
import { AccountingExportButtons } from "./AccountingExportButtons";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Ticket,
  DollarSign,
  Package,
  Target,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface BookingRow {
  id: string;
  event_date: string;
  total_amount: number;
  discount_amount: number | null;
  coupon_code: string | null;
  product_id: string | null;
  product_name: string | null;
  customer_email: string;
  payment_method: string | null;
  stripe_payment_status: string;
  booking_status: string;
  created_at: string;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

function monthLabel(yyyy_mm: string): string {
  const [y, m] = yyyy_mm.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  // Admin-only
  const me = await getCurrentUserRole();
  if (!me || me.role !== "admin") redirect("/admin/dashboard");

  const def = defaultRange();
  const from = searchParams.from || def.from;
  const to = searchParams.to || def.to;

  const supabase = createAdminClient();

  // Fetch bookings in date range. Use event_date for "when service happens"
  // (more meaningful than created_at for revenue reports).
  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      "id, event_date, total_amount, discount_amount, coupon_code, product_id, product_name, customer_email, payment_method, stripe_payment_status, booking_status, created_at",
    )
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: false });

  const bookings: BookingRow[] = (bookingsRaw as BookingRow[]) || [];

  // Only count revenue from PAID bookings
  const paid = bookings.filter(
    (b) => b.stripe_payment_status === "paid" && b.booking_status !== "cancelled",
  );

  // ─── Summary metrics ────────────────────────────────────────────────────
  const totalRevenue = paid.reduce((s, b) => s + (b.total_amount || 0), 0);
  const totalBookings = paid.length;
  const avgBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
  const totalDiscount = paid.reduce((s, b) => s + (b.discount_amount || 0), 0);

  // ─── Revenue by payment method ──────────────────────────────────────────
  const byMethod = new Map<string, { count: number; revenue: number }>();
  paid.forEach((b) => {
    const m = b.payment_method || "stripe";
    const entry = byMethod.get(m) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.total_amount || 0;
    byMethod.set(m, entry);
  });
  const paymentMethods = Array.from(byMethod.entries())
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // ─── Revenue by month ───────────────────────────────────────────────────
  const byMonth = new Map<string, number>();
  paid.forEach((b) => {
    const m = b.event_date.substring(0, 7); // YYYY-MM
    byMonth.set(m, (byMonth.get(m) || 0) + (b.total_amount || 0));
  });
  const months = Array.from(byMonth.entries())
    .map(([m, revenue]) => ({ month: m, label: monthLabel(m), revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const maxMonthRev = Math.max(1, ...months.map((m) => m.revenue));

  // ─── Top products ───────────────────────────────────────────────────────
  const byProduct = new Map<string, { name: string; count: number; revenue: number }>();
  paid.forEach((b) => {
    const key = b.product_id || b.product_name || "unknown";
    const name = b.product_name || "(unknown)";
    const entry = byProduct.get(key) || { name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.total_amount || 0;
    byProduct.set(key, entry);
  });
  const topProducts = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);

  // ─── Customers (new vs returning) ───────────────────────────────────────
  // To know "returning": query ALL bookings ever for these emails, see if any
  // exist BEFORE the range starts.
  const emailsInRange = Array.from(new Set(paid.map((b) => b.customer_email.toLowerCase())));

  let returningEmails = new Set<string>();
  if (emailsInRange.length > 0) {
    const { data: priorRows } = await supabase
      .from("bookings")
      .select("customer_email")
      .in("customer_email", emailsInRange)
      .lt("event_date", from)
      .eq("stripe_payment_status", "paid");
    returningEmails = new Set(
      (priorRows || []).map((r: any) => (r.customer_email || "").toLowerCase()),
    );
  }
  const uniqueCustomers = emailsInRange.length;
  const returningCount = emailsInRange.filter((e) => returningEmails.has(e)).length;
  const newCount = uniqueCustomers - returningCount;

  // Top customers by spend in range
  const byCustomer = new Map<string, { email: string; count: number; revenue: number }>();
  paid.forEach((b) => {
    const k = b.customer_email.toLowerCase();
    const entry = byCustomer.get(k) || { email: b.customer_email, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.total_amount || 0;
    byCustomer.set(k, entry);
  });
  const topCustomers = Array.from(byCustomer.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ─── Coupons ────────────────────────────────────────────────────────────
  const byCoupon = new Map<string, { code: string; uses: number; discount: number }>();
  paid.forEach((b) => {
    if (!b.coupon_code) return;
    const entry = byCoupon.get(b.coupon_code) || {
      code: b.coupon_code,
      uses: 0,
      discount: 0,
    };
    entry.uses += 1;
    entry.discount += b.discount_amount || 0;
    byCoupon.set(b.coupon_code, entry);
  });
  const coupons = Array.from(byCoupon.values()).sort((a, b) => b.discount - a.discount);

  // ─── LIFETIME PROFITABILITY (per-product ROI) ─────────────────────────
  // Independent of date range — looks at ALL paid bookings ever for each
  // active product, compares to product.cost_cents.
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name, slug, category, price_per_day, cost_cents, stock, is_active, is_addon")
    .eq("is_active", true)
    .eq("is_addon", false)
    .order("category")
    .order("name");

  const { data: allPaidBookings } = await supabase
    .from("bookings")
    .select("product_id, total_amount, stripe_payment_status, booking_status")
    .eq("stripe_payment_status", "paid")
    .neq("booking_status", "cancelled");

  // Map product_id → { count, revenue }
  const lifetimeByProduct = new Map<string, { count: number; revenue: number }>();
  for (const b of (allPaidBookings as any[]) || []) {
    if (!b.product_id) continue;
    const entry = lifetimeByProduct.get(b.product_id) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.total_amount || 0;
    lifetimeByProduct.set(b.product_id, entry);
  }

  const profitability = ((allProducts as any[]) || []).map((p) => {
    const lifetime = lifetimeByProduct.get(p.id) || { count: 0, revenue: 0 };
    const cost = p.cost_cents || 0;
    const profit = lifetime.revenue - cost;
    const roi = cost > 0 ? (lifetime.revenue / cost) * 100 : 0;
    const recouped = cost > 0 && lifetime.revenue >= cost;
    const rentalsToBreakEven = cost > 0 && p.price_per_day > 0
      ? Math.ceil(cost / p.price_per_day)
      : null;
    return {
      ...p,
      lifetime_count: lifetime.count,
      lifetime_revenue: lifetime.revenue,
      profit,
      roi,
      recouped,
      rentalsToBreakEven,
    };
  });

  // Stats: total fleet investment + total earned + total profit
  const totalCost = profitability.reduce((s, p) => s + (p.cost_cents || 0), 0);
  const totalLifetimeRevenue = profitability.reduce((s, p) => s + p.lifetime_revenue, 0);
  const totalProfit = totalLifetimeRevenue - totalCost;
  const fleetRoi = totalCost > 0 ? (totalLifetimeRevenue / totalCost) * 100 : 0;
  const recoupedCount = profitability.filter((p) => p.recouped).length;
  const noCostCount = profitability.filter((p) => (p.cost_cents || 0) === 0).length;

  // Sort: highest ROI first, but ones with cost=0 (no data) at the bottom
  const sortedProfitability = [...profitability].sort((a, b) => {
    if ((a.cost_cents || 0) === 0 && (b.cost_cents || 0) > 0) return 1;
    if ((b.cost_cents || 0) === 0 && (a.cost_cents || 0) > 0) return -1;
    return b.roi - a.roi;
  });

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy mb-1">Reports</h1>
        <p className="text-sm text-slate-500 mb-4">
          Counts and totals are for <strong>paid</strong> bookings only, by event date.
        </p>
        <DateRangeForm initialFrom={from} initialTo={to} />
      </div>

      {/* P&L summary — Revenue minus direct costs minus allocated overhead */}
      <PnLCard from={from} to={to} />

      {/* Download CSVs for QuickBooks / accountant */}
      <AccountingExportButtons from={from} to={to} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={DollarSign}
          label="Total revenue"
          value={formatCurrency(totalRevenue)}
          subtitle={totalDiscount > 0 ? `${formatCurrency(totalDiscount)} in discounts` : undefined}
          tone="green"
        />
        <SummaryCard
          icon={ShoppingBag}
          label="Bookings paid"
          value={String(totalBookings)}
          tone="blue"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Avg booking value"
          value={formatCurrency(avgBookingValue)}
          tone="purple"
        />
        <SummaryCard
          icon={Users}
          label="Unique customers"
          value={String(uniqueCustomers)}
          subtitle={`${newCount} new · ${returningCount} returning`}
          tone="amber"
        />
      </div>

      {/* Revenue by month chart */}
      {months.length > 0 && (
        <Section title="Revenue by month" icon={TrendingUp}>
          <div className="space-y-2">
            {months.map((m) => (
              <div key={m.month} className="flex items-center gap-3 text-sm">
                <div className="w-24 text-slate-600 text-xs">{m.label}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-brand-yellow rounded"
                    style={{ width: `${(m.revenue / maxMonthRev) * 100}%` }}
                  />
                </div>
                <div className="w-28 text-right font-mono text-brand-navy font-semibold">
                  {formatCurrency(m.revenue)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Payment methods */}
      {paymentMethods.length > 0 && (
        <Section title="Revenue by payment method" icon={DollarSign}>
          <Table
            headers={["Method", "Bookings", "Revenue", "% of total"]}
            rows={paymentMethods.map((p) => [
              <span key="m" className="capitalize">{p.method}</span>,
              <span key="c" className="font-mono">{p.count}</span>,
              <span key="r" className="font-mono">{formatCurrency(p.revenue)}</span>,
              <span key="p" className="font-mono text-slate-500">
                {totalRevenue > 0 ? `${((p.revenue / totalRevenue) * 100).toFixed(1)}%` : "—"}
              </span>,
            ])}
          />
        </Section>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <Section title="Top products" icon={Package}>
          <Table
            headers={["Product", "Bookings", "Revenue"]}
            rows={topProducts.slice(0, 20).map((p, i) => [
              <div key="n">
                <span className="text-slate-400 mr-2">#{i + 1}</span>
                {p.name}
              </div>,
              <span key="c" className="font-mono">{p.count}</span>,
              <span key="r" className="font-mono font-semibold text-brand-navy">
                {formatCurrency(p.revenue)}
              </span>,
            ])}
          />
        </Section>
      )}

      {/* Top customers */}
      {topCustomers.length > 0 && (
        <Section title="Top customers (by spend in range)" icon={Users}>
          <Table
            headers={["Email", "Bookings", "Revenue", "Type"]}
            rows={topCustomers.map((c) => [
              <span key="e" className="text-sm">{c.email}</span>,
              <span key="c" className="font-mono">{c.count}</span>,
              <span key="r" className="font-mono">{formatCurrency(c.revenue)}</span>,
              returningEmails.has(c.email.toLowerCase()) ? (
                <span key="t" className="text-xs bg-green-100 text-green-800 rounded px-2 py-0.5">
                  Returning
                </span>
              ) : (
                <span key="t" className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-0.5">
                  New
                </span>
              ),
            ])}
          />
        </Section>
      )}

      {/* Coupons */}
      {coupons.length > 0 ? (
        <Section title="Coupon usage" icon={Ticket}>
          <Table
            headers={["Code", "Uses", "Total discount", "Avg discount"]}
            rows={coupons.map((c) => [
              <span key="c" className="font-mono font-semibold">{c.code}</span>,
              <span key="u" className="font-mono">{c.uses}</span>,
              <span key="d" className="font-mono text-amber-700">
                -{formatCurrency(c.discount)}
              </span>,
              <span key="a" className="font-mono text-slate-500">
                -{formatCurrency(c.discount / c.uses)}
              </span>,
            ])}
          />
        </Section>
      ) : (
        <Section title="Coupon usage" icon={Ticket}>
          <p className="text-sm text-slate-400">No coupons used in this date range.</p>
        </Section>
      )}

      {paid.length === 0 && (
        <div className="card text-center text-slate-400 py-12">
          No paid bookings in this date range. Try widening the dates above.
        </div>
      )}

      {/* ─── LIFETIME PROFITABILITY (all-time, independent of date filter) ─── */}
      <div className="pt-8 mt-8 border-t-2 border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-brand-navy flex items-center gap-2">
              <Target className="h-5 w-5" /> Fleet profitability (all-time)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Lifetime ROI per product based on your <strong>cost</strong> (set in
              product editor) vs total paid revenue.
            </p>
          </div>
        </div>

        {/* Fleet-wide stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <SummaryCard
            icon={DollarSign}
            label="Total fleet cost"
            value={formatCurrency(totalCost)}
            subtitle={`${profitability.length} products`}
            tone="amber"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Lifetime revenue"
            value={formatCurrency(totalLifetimeRevenue)}
            tone="blue"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Net profit"
            value={formatCurrency(totalProfit)}
            subtitle={fleetRoi > 0 ? `${fleetRoi.toFixed(0)}% ROI` : undefined}
            tone={totalProfit >= 0 ? "green" : "amber"}
          />
          <SummaryCard
            icon={Target}
            label="Products paid off"
            value={`${recoupedCount} / ${profitability.length - noCostCount}`}
            subtitle={noCostCount > 0 ? `${noCostCount} missing cost data` : undefined}
            tone="purple"
          />
        </div>

        {/* Per-product breakdown */}
        {noCostCount > 0 && (
          <div className="card bg-amber-50 border-amber-200 mb-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900">
                {noCostCount} product{noCostCount === 1 ? "" : "s"} missing cost data
              </h3>
              <p className="text-sm text-amber-800">
                Edit each product and set its <strong>Cost</strong> field to enable ROI tracking.
              </p>
            </div>
          </div>
        )}

        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Rentals</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-right">ROI</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedProfitability.map((p: any) => {
                const noData = (p.cost_cents || 0) === 0;
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.category}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {noData ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        formatCurrency(p.cost_cents)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{p.lifetime_count}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(p.lifetime_revenue)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${
                        noData
                          ? "text-slate-400"
                          : p.profit >= 0
                            ? "text-green-700"
                            : "text-red-600"
                      }`}
                    >
                      {noData ? "—" : formatCurrency(p.profit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {noData ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`font-mono text-xs rounded px-2 py-0.5 ${
                            p.roi >= 100
                              ? "bg-green-100 text-green-800"
                              : p.roi >= 50
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.roi.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {noData ? (
                        <span className="text-slate-400">No cost set</span>
                      ) : p.recouped ? (
                        <span className="text-green-700 font-semibold">
                          ✓ Paid off ({p.lifetime_count}× rented)
                        </span>
                      ) : p.rentalsToBreakEven != null ? (
                        <span className="text-slate-600">
                          {Math.max(0, p.rentalsToBreakEven - p.lifetime_count)} more
                          to break even
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  tone: "green" | "blue" | "purple" | "amber";
}) {
  const tones: Record<string, string> = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="card">
      <div className={`inline-flex items-center justify-center h-8 w-8 rounded ${tones[tone]} mb-2`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-brand-navy mt-1">{value}</div>
      {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-brand-navy/70" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-navy/70">{title}</h2>
      </div>
      <div className="card p-4">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-slate-500">
          {headers.map((h, i) => (
            <th key={i} className={`px-2 py-2 text-left ${i > 0 ? "text-right" : ""}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={`px-2 py-2 ${j > 0 ? "text-right" : ""}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
